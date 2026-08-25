import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import { buildTargetAudienceQuery, buildTargetAudience, describeTargetAudience } from '@/lib/targeting.js';

/**
 * POST /api/student-count
 *
 * Body: { targetAudience: { branch, year, semester, section, subject } }
 *
 * Returns: { count, description, students: [{ id, name, section }] }
 * Faculty-only endpoint.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'faculty' && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Faculty role required' }, { status: 403 });
    }

    const body = await request.json();
    const { targetAudience } = body;

    await connectToDatabase();

    const audience = buildTargetAudience(targetAudience || {});
    const query = { role: 'student', ...buildTargetAudienceQuery(audience) };

    const students = await User.find(query)
      .select('name classOrSubject subjects')
      .lean();

    return NextResponse.json({
      count: students.length,
      description: describeTargetAudience(audience),
      students: students.map(s => ({
        id: s._id,
        name: s.name,
        section: s.classOrSubject,
      })),
    });
  } catch (error) {
    console.error('[student-count] POST error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// Also support GET for branch/year/section listing
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');

    // Get unique branches
    const students = await User.find({ role: 'student' }).select('classOrSubject subjects').lean();

    const branches = [...new Set(students.map(s => {
      const match = (s.classOrSubject || '').match(/^([A-Z]+)/);
      return match ? match[1] : '';
    }).filter(Boolean))];

    // Get sections for a branch
    let sections = [];
    if (branch) {
      sections = [...new Set(students
        .filter(s => (s.classOrSubject || '').toUpperCase().startsWith(branch.toUpperCase()))
        .map(s => {
          const match = (s.classOrSubject || '').match(/^[A-Z]+[-_]?([A-D])/i);
          return match ? match[1].toUpperCase() : '';
        })
        .filter(Boolean))];
    }

    // Get subjects
    const subjects = [...new Set(students.flatMap(s => [...(s.subjects || [])]))].filter(Boolean);

    return NextResponse.json({ branches, sections, subjects });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
