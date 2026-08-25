import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import { ClassTask, TaskCompletion } from '@/lib/models/ClassTask.js';
import User from '@/lib/models/User.js';
import { onClassTaskCreated } from '@/lib/notificationEngine.js';

// ── GET: Fetch tasks ─────────────────────────────────────────────────────────
// Faculty: GET /api/class-tasks?section=CSE-A (their created tasks)
// Student: GET /api/class-tasks (tasks for their section, with completion status)
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = session.user.role;
    const section = searchParams.get('section');
    const subject = searchParams.get('subject');
    const date = searchParams.get('date'); // ISO date string or "today"

    await connectToDatabase();

    // Build query
    const query = { isActive: true };

    if (role === 'faculty') {
      // Faculty sees their own tasks (optionally filtered)
      query.createdBy = session.user.id;
      if (section) query.section = section;
    } else if (role === 'student') {
      // Students see tasks for their section
      const userSection = session.user.classOrSubject;
      query.section = userSection;
    }

    if (subject) query.subject = subject;

    // Date filtering
    if (date === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      query.dueDate = { $gte: today, $lt: tomorrow };
    } else if (date) {
      const d = new Date(date);
      const dayEnd = new Date(d);
      dayEnd.setDate(dayEnd.getDate() + 1);
      query.dueDate = { $gte: d, $lt: dayEnd };
    }

    const tasks = await ClassTask.find(query)
      .sort({ dueDate: 1, priority: -1 })
      .populate('createdBy', 'name')
      .lean();

    // For students, attach completion status
    let completions = [];
    if (role === 'student' && tasks.length > 0) {
      const taskIds = tasks.map(t => t._id);
      completions = await TaskCompletion.find({
        taskId: { $in: taskIds },
        studentId: session.user.id,
      }).lean();
    }

    const completionMap = {};
    completions.forEach(c => {
      completionMap[String(c.taskId)] = {
        completed: c.completed,
        completedAt: c.completedAt,
      };
    });

    const enrichedTasks = tasks.map(t => ({
      ...t,
      completion: completionMap[String(t._id)] || { completed: false, completedAt: null },
    }));

    // Faculty analytics: completion rates per task
    let analytics = null;
    if (role === 'faculty' && tasks.length > 0) {
      const taskIds = tasks.map(t => t._id);
      const allCompletions = await TaskCompletion.find({
        taskId: { $in: taskIds },
        completed: true,
      }).lean();

      // Count enrolled students per section
      const sections = [...new Set(tasks.map(t => t.section))];
      const studentCounts = await User.countDocuments({
        role: 'student',
        classOrSubject: { $in: sections },
      });

      const completionCounts = {};
      allCompletions.forEach(c => {
        const tid = String(c.taskId);
        completionCounts[tid] = (completionCounts[tid] || 0) + 1;
      });

      analytics = tasks.map(t => ({
        taskId: String(t._id),
        title: t.title,
        section: t.section,
        subject: t.subject,
        completedCount: completionCounts[String(t._id)] || 0,
        totalCount: studentCounts,
        completionRate: studentCounts > 0
          ? Math.round(((completionCounts[String(t._id)] || 0) / studentCounts) * 100)
          : 0,
      }));
    }

    return NextResponse.json({ tasks: enrichedTasks, analytics });
  } catch (error) {
    console.error('[class-tasks] GET error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// ── POST: Create a task (faculty) or toggle completion (student) ─────────────
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    await connectToDatabase();

    // ── Faculty: create task ──
    if (action === 'create' && session.user.role === 'faculty') {
      const { section, subject, title, description, taskType, priority, dueDate, dueTime, resourceUrl, resourceTitle } = body;
      if (!section || !subject || !title || !dueDate) {
        return NextResponse.json({ error: 'section, subject, title, and dueDate are required' }, { status: 400 });
      }

      const task = await ClassTask.create({
        createdBy: session.user.id,
        section,
        subject,
        title,
        description: description || '',
        taskType: taskType || 'study',
        priority: priority || 'medium',
        dueDate: new Date(dueDate),
        dueTime: dueTime || '',
        resourceUrl: resourceUrl || '',
        resourceTitle: resourceTitle || '',
      });

      // Generate notifications for matching students
      try {
        const { buildTargetAudienceQuery } = await import('@/lib/targeting.js');
        const sectionQuery = buildTargetAudienceQuery({ section });
        const matchingStudents = await User.find({ role: 'student', ...sectionQuery }).select('_id').lean();
        const studentIds = matchingStudents.map(s => s._id);
        await onClassTaskCreated(task, studentIds);
      } catch (notifErr) {
        console.warn('[class-tasks] Notification generation failed:', notifErr.message);
      }

      return NextResponse.json({ success: true, task });
    }

    // ── Student: toggle task completion ──
    if (action === 'toggle_completion' && session.user.role === 'student') {
      const { taskId, completed } = body;
      if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      }

      const result = await TaskCompletion.findOneAndUpdate(
        { taskId, studentId: session.user.id },
        {
          completed: completed !== undefined ? completed : true,
          completedAt: completed !== false ? new Date() : null,
        },
        { upsert: true, returnDocument: 'after' }
      );

      return NextResponse.json({ success: true, completion: result });
    }

    // ── Faculty: delete task ──
    if (action === 'delete' && session.user.role === 'faculty') {
      const { taskId } = body;
      if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      }

      await ClassTask.findOneAndUpdate(
        { _id: taskId, createdBy: session.user.id },
        { isActive: false }
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[class-tasks] POST error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
