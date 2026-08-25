import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import { Assignment, Submission } from '@/lib/models/Assignment.js';
import Course from '@/lib/models/Course.js';
import AcademicEvent from '@/lib/models/AcademicEvent.js';
import User from '@/lib/models/User.js';
import { parseClassOrSubject } from '@/lib/targeting.js';
import { onAcademicEventCreated } from '@/lib/notificationEngine.js';

/**
 * Safely resolve the authenticated user's DB record.
 */
async function resolveUser(session) {
  if (!session?.user?.id) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = await User.findById(session.user.id).lean();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'User account not found' }, { status: 404 }) };
  }
  return { user, error: null };
}

/**
 * Safely parse classOrSubject — never throws on null/undefined.
 */
function safeParseClass(classOrSubject) {
  return parseClassOrSubject(classOrSubject || '');
}

/**
 * GET /api/assignments
 * Faculty: assignments they created, or for a specific course
 * Student: assignments for their courses/section
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { user, error } = await resolveUser(session);
    if (error) return error;

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const role = user.role;

    let query = { isActive: true };

    if (courseId) {
      query.courseId = courseId;
    } else if (role === 'student') {
      // Get student's courses
      const { branch, section } = safeParseClass(user.classOrSubject);
      if (!branch) return NextResponse.json({ assignments: [] });
      const courses = await Course.find({
        branch,
        $or: [{ sections: { $in: [section] } }, { sections: { $size: 0 } }],
      }).lean();
      query.courseId = { $in: courses.map(c => c._id) };
    } else if (role === 'faculty') {
      const courses = await Course.find({ facultyIds: user._id.toString() }).lean();
      query.courseId = { $in: courses.map(c => c._id) };
    }

    const assignments = await Assignment.find(query)
      .sort({ dueDate: -1 })
      .limit(50)
      .lean();

    // For students: attach submission status
    if (role === 'student') {
      const submissions = await Submission.find({
        studentId: user._id.toString(),
        assignmentId: { $in: assignments.map(a => a._id) },
      }).lean();
      const subMap = {};
      submissions.forEach(s => { subMap[String(s.assignmentId)] = s; });

      const enriched = assignments.map(a => ({
        ...a,
        submission: subMap[String(a._id)] || null,
      }));
      return NextResponse.json({ assignments: enriched });
    }

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('[assignments] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/assignments
 * Faculty: create/update assignment (auto-syncs to calendar)
 * Student: submit assignment
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const { user, error } = await resolveUser(session);
    if (error) return error;

    await connectToDatabase();
    const body = await request.json();
    const { action } = body;
    const role = user.role;

    // ── Student: submit assignment ──
    if (action === 'submit' && role === 'student') {
      const { assignmentId, content, fileUrl, fileName } = body;
      if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });

      const assignment = await Assignment.findById(assignmentId).lean();
      if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

      const submission = await Submission.findOneAndUpdate(
        { assignmentId, studentId: user._id.toString() },
        {
          courseId: assignment.courseId,
          content: content || '',
          fileUrl: fileUrl || '',
          fileName: fileName || '',
          status: 'submitted',
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({ success: true, submission });
    }

    // ── Faculty: create assignment ──
    if (action === 'create' && (role === 'faculty' || role === 'admin')) {
      const { courseId, title, description, type, dueDate, dueTime, maxScore, attachments } = body;
      if (!courseId || !title || !dueDate) {
        return NextResponse.json({ error: 'courseId, title, and dueDate required' }, { status: 400 });
      }

      const course = await Course.findById(courseId).lean();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      if (role !== 'admin' && !course.facultyIds.map(String).includes(user._id.toString())) {
        return NextResponse.json({ error: 'Not authorized for this course' }, { status: 403 });
      }

      const assignment = await Assignment.create({
        courseId,
        createdBy: user._id.toString(),
        title,
        description: description || '',
        type: type || 'assignment',
        branch: course.branch,
        year: course.year,
        semester: course.semester,
        section: course.sections?.[0] || '',
        subject: course.name,
        dueDate: new Date(dueDate),
        dueTime: dueTime || '',
        maxScore: maxScore || 100,
        attachments: attachments || [],
      });

      // ── AUTO-SYNC: Create calendar event ──
      try {
        const targetAudience = {
          branch: course.branch,
          year: course.year,
          semester: course.semester,
          section: course.sections?.[0] || '',
          subject: course.name,
        };

        const calendarEvent = await AcademicEvent.create({
          createdBy: user._id.toString(),
          title: `📋 ${title}`,
          description: description || `Assignment: ${title} — ${course.name}`,
          eventType: 'assignment',
          priority: 'important',
          date: new Date(dueDate),
          startTime: dueTime || '',
          subject: course.name,
          section: course.sections?.[0] || '',
          targetAudience,
        });

        // Link calendar event back to assignment
        await Assignment.findByIdAndUpdate(assignment._id, { calendarEventId: calendarEvent._id });

        // Notify matching students
        const matchingStudents = await User.find({
          role: 'student',
          classOrSubject: new RegExp(`^${course.branch}`, 'i'),
        }).select('_id').lean();
        const studentIds = matchingStudents.map(s => s._id);
        await onAcademicEventCreated(calendarEvent, studentIds);
      } catch (syncErr) {
        console.warn('[assignments] Calendar sync failed:', syncErr.message);
      }

      return NextResponse.json({ success: true, assignment });
    }

    // ── Faculty: update assignment (syncs calendar) ──
    if (action === 'update' && (role === 'faculty' || role === 'admin')) {
      const { assignmentId, title, description, dueDate, dueTime, ...rest } = body;
      if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });

      const assignment = await Assignment.findById(assignmentId).lean();
      if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
      if (dueTime !== undefined) updates.dueTime = dueTime;

      const updated = await Assignment.findByIdAndUpdate(assignmentId, { $set: updates }, { new: true }).lean();

      // ── AUTO-SYNC: Update calendar event ──
      if (assignment.calendarEventId) {
        try {
          const calUpdates = {};
          if (title !== undefined) calUpdates.title = `📋 ${title}`;
          if (description !== undefined) calUpdates.description = description;
          if (dueDate !== undefined) calUpdates.date = new Date(dueDate);
          if (dueTime !== undefined) calUpdates.startTime = dueTime;
          await AcademicEvent.findByIdAndUpdate(assignment.calendarEventId, { $set: calUpdates });
        } catch (syncErr) {
          console.warn('[assignments] Calendar sync update failed:', syncErr.message);
        }
      }

      return NextResponse.json({ success: true, assignment: updated });
    }

    // ── Faculty: delete assignment (removes calendar event) ──
    if (action === 'delete' && (role === 'faculty' || role === 'admin')) {
      const { assignmentId } = body;
      if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });

      const assignment = await Assignment.findById(assignmentId).lean();
      if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

      // Remove linked calendar event
      if (assignment.calendarEventId) {
        try {
          await AcademicEvent.findByIdAndUpdate(assignment.calendarEventId, { $set: { isActive: false } });
        } catch { /* non-fatal */ }
      }

      await Assignment.findByIdAndUpdate(assignmentId, { $set: { isActive: false } });
      return NextResponse.json({ success: true });
    }

    // ── Faculty: grade submission ──
    if (action === 'grade' && (role === 'faculty' || role === 'admin')) {
      const { submissionId, score, feedback } = body;
      if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 });

      const submission = await Submission.findByIdAndUpdate(submissionId, {
        $set: {
          score,
          feedback: feedback || '',
          gradedBy: user._id.toString(),
          gradedAt: new Date(),
          status: 'graded',
        }
      }, { new: true }).lean();

      return NextResponse.json({ success: true, submission });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[assignments] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
