import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Course from '@/lib/models/Course.js';
import User from '@/lib/models/User.js';
import { parseClassOrSubject } from '@/lib/targeting.js';

/**
 * Helper: safely resolve the authenticated user's DB record.
 * Returns { user, error } — caller checks `error` before using `user`.
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
 * Safely parse classOrSubject — never throws on null/undefined input.
 */
function safeParseClass(classOrSubject) {
  return parseClassOrSubject(classOrSubject || '');
}

/**
 * GET /api/courses
 * Faculty: returns courses they teach
 * Student: returns courses for their branch/section
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { user, error } = await resolveUser(session);
    if (error) return error;

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('id');
    const role = user.role;

    // Single course by ID
    if (courseId) {
      const course = await Course.findById(courseId).lean();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

      // Students: check they're in an authorized section
      if (role === 'student') {
        const { branch: studentBranch, section: studentSection } = safeParseClass(user.classOrSubject);
        if (course.branch !== studentBranch) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        if (course.sections.length > 0 && !course.sections.includes(studentSection)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }

      return NextResponse.json({ course });
    }

    // List courses
    let query = { isActive: true, isArchived: false };

    if (role === 'faculty' || role === 'admin') {
      // Faculty: courses they teach
      query.facultyIds = user._id.toString();
    } else {
      // Student: courses for their branch/section
      const { branch: studentBranch, section: studentSection } = safeParseClass(user.classOrSubject);

      // If student has no branch data, return empty — don't crash
      if (!studentBranch) {
        return NextResponse.json({ courses: [] });
      }

      query.branch = studentBranch;
      query.$or = [
        { sections: { $in: [studentSection] } },
        { sections: { $size: 0 } }, // No section restriction = all sections
      ];
    }

    const courses = await Course.find(query)
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ courses });
  } catch (error) {
    console.error('[courses] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/courses
 * Faculty/Admin: create or update a course
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const { user, error } = await resolveUser(session);
    if (error) return error;

    if (user.role !== 'faculty' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Faculty role required' }, { status: 403 });
    }

    await connectToDatabase();
    const body = await request.json();
    const { action } = body;

    // ── Create course ──
    if (action === 'create') {
      const { name, code, description, branch, year, semester, sections } = body;
      if (!name || !branch) return NextResponse.json({ error: 'name and branch required' }, { status: 400 });

      const course = await Course.create({
        name, code: code || '', description: description || '',
        branch, year: parseInt(year) || 0, semester: parseInt(semester) || 0,
        sections: sections || [],
        facultyIds: [user._id.toString()],
      });

      return NextResponse.json({ success: true, course });
    }

    // ── Update course ──
    if (action === 'update') {
      const { courseId, ...updates } = body;
      if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

      const course = await Course.findById(courseId).lean();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      if (user.role !== 'admin' && !course.facultyIds.map(String).includes(user._id.toString())) {
        return NextResponse.json({ error: 'Not authorized for this course' }, { status: 403 });
      }

      const updated = await Course.findByIdAndUpdate(courseId, { $set: updates }, { new: true }).lean();
      return NextResponse.json({ success: true, course: updated });
    }

    // ── Add module ──
    if (action === 'addModule') {
      const { courseId, title, description } = body;
      if (!courseId || !title) return NextResponse.json({ error: 'courseId and title required' }, { status: 400 });

      const course = await Course.findById(courseId).lean();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      if (user.role !== 'admin' && !course.facultyIds.map(String).includes(user._id.toString())) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      const order = course.modules?.length || 0;
      const updated = await Course.findByIdAndUpdate(courseId, {
        $push: { modules: { title, description: description || '', order, materials: [] } }
      }, { new: true }).lean();

      return NextResponse.json({ success: true, course: updated });
    }

    // ── Add material to module ──
    if (action === 'addMaterial') {
      const { courseId, moduleIndex, title, type, url, content } = body;
      if (courseId === undefined || moduleIndex === undefined || !title) {
        return NextResponse.json({ error: 'courseId, moduleIndex, and title required' }, { status: 400 });
      }

      const course = await Course.findById(courseId).lean();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      if (user.role !== 'admin' && !course.facultyIds.map(String).includes(user._id.toString())) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      if (!course.modules[moduleIndex]) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

      const materialOrder = course.modules[moduleIndex].materials?.length || 0;
      const updatePath = `modules.${moduleIndex}.materials`;
      const updated = await Course.findByIdAndUpdate(courseId, {
        $push: { [updatePath]: { title, type: type || 'note', url: url || '', content: content || '', order: materialOrder } }
      }, { new: true }).lean();

      return NextResponse.json({ success: true, course: updated });
    }

    // ── Delete module ──
    if (action === 'deleteModule') {
      const { courseId, moduleIndex } = body;
      if (courseId === undefined || moduleIndex === undefined) {
        return NextResponse.json({ error: 'courseId and moduleIndex required' }, { status: 400 });
      }

      const course = await Course.findById(courseId).lean();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      if (user.role !== 'admin' && !course.facultyIds.map(String).includes(user._id.toString())) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      const modules = [...(course.modules || [])];
      modules.splice(moduleIndex, 1);
      modules.forEach((m, i) => { m.order = i; });

      const updated = await Course.findByIdAndUpdate(courseId, { $set: { modules } }, { new: true }).lean();
      return NextResponse.json({ success: true, course: updated });
    }

    // ── Delete material ──
    if (action === 'deleteMaterial') {
      const { courseId, moduleIndex, materialIndex } = body;
      const course = await Course.findById(courseId).lean();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      if (user.role !== 'admin' && !course.facultyIds.map(String).includes(user._id.toString())) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      const modules = JSON.parse(JSON.stringify(course.modules || []));
      if (!modules[moduleIndex]) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
      modules[moduleIndex].materials.splice(materialIndex, 1);

      const updated = await Course.findByIdAndUpdate(courseId, { $set: { modules } }, { new: true }).lean();
      return NextResponse.json({ success: true, course: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[courses] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
