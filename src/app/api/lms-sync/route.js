import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Course from '@/lib/models/Course.js';
import User from '@/lib/models/User.js';

// ── Moodle adapter ────────────────────────────────────────────────────────────
async function fetchMoodleCourses() {
  const base  = process.env.MOODLE_URL;
  const token = process.env.MOODLE_TOKEN;
  if (!base || !token) throw new Error('MOODLE_URL or MOODLE_TOKEN not configured');

  const url = `${base}/webservice/rest/server.php?wstoken=${token}&moodlewsrestformat=json`;

  const coursesRes = await fetch(`${url}&wsfunction=core_course_get_courses`);
  const courses    = await coursesRes.json();
  if (!Array.isArray(courses)) throw new Error('Moodle returned unexpected response');

  return courses.map(c => ({
    externalId: String(c.id),
    source:     'moodle',
    name:       c.fullname || c.shortname,
    subject:    c.shortname || '',
    section:    c.idnumber  || '',
    rawEnrolled: [],   // roster fetch omitted for brevity — add core_enrol_get_enrolled_users if needed
  }));
}

// ── Google Classroom adapter ──────────────────────────────────────────────────
async function fetchGoogleCourses(accessToken) {
  if (!accessToken) throw new Error('Google access token required');

  const res  = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Google Classroom API error');

  const courses = data.courses || [];

  return await Promise.all(courses.map(async (c) => {
    // Fetch enrolled students
    const rosterRes = await fetch(
      `https://classroom.googleapis.com/v1/courses/${c.id}/students`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const rosterData = await rosterRes.json();
    const emails = (rosterData.students || []).map(s => s.profile?.emailAddress).filter(Boolean);

    return {
      externalId:  c.id,
      source:      'google_classroom',
      name:        c.name,
      subject:     c.name,
      section:     c.section || '',
      rawEnrolled: emails,
    };
  }));
}

// ── Upsert into MongoDB ───────────────────────────────────────────────────────
async function upsertCourses(courseDtos) {
  const results = [];

  for (const dto of courseDtos) {
    // Resolve enrolled student ObjectIds from emails
    let enrolledStudentIds = [];
    if (dto.rawEnrolled?.length) {
      const users = await User.find({ email: { $in: dto.rawEnrolled }, role: 'student' }).lean();
      enrolledStudentIds = users.map(u => u._id);
    }

    const doc = await Course.findOneAndUpdate(
      { externalId: dto.externalId, source: dto.source },
      {
        $set: {
          name:               dto.name,
          subject:            dto.subject,
          section:            dto.section,
          enrolledStudentIds,
          syncedAt:           new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    results.push({ id: String(doc._id), name: doc.name, source: doc.source, enrolled: enrolledStudentIds.length });
  }

  return results;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const session  = await getServerSession(authOptions);
    const userRole = session?.user?.role || 'faculty';

    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body   = await request.json();
    const source = body.source; // 'moodle' | 'google_classroom'

    let courseDtos = [];

    if (source === 'moodle') {
      courseDtos = await fetchMoodleCourses();
    } else if (source === 'google_classroom') {
      const accessToken = body.accessToken;
      courseDtos = await fetchGoogleCourses(accessToken);
    } else {
      return NextResponse.json({ error: 'source must be "moodle" or "google_classroom"' }, { status: 400 });
    }

    const synced = await upsertCourses(courseDtos);

    return NextResponse.json({ success: true, synced, count: synced.length });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// GET — return currently synced courses
export async function GET() {
  try {
    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ courses: [] });

    const courses = await Course.find({}).sort({ syncedAt: -1 }).lean();
    return NextResponse.json({
      courses: courses.map(c => ({
        id:       String(c._id),
        name:     c.name,
        subject:  c.subject,
        section:  c.section,
        source:   c.source,
        enrolled: c.enrolledStudentIds?.length || 0,
        syncedAt: c.syncedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
