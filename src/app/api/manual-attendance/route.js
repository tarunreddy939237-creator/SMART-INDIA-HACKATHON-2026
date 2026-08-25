import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { saveManualAttendance, getManualAttendanceByFaculty, getManualAttendanceSummary, getClassRoster } from '@/lib/queries.js';

export async function GET(request) {
  try {
    const session  = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userRole = session.user.role;
    const userId   = session.user.id;
    const { searchParams } = new URL(request.url);
    const section  = searchParams.get('section');
    const summary  = searchParams.get('summary');

    // Roster request — any authenticated user with a section param
    if (section) {
      const roster = await getClassRoster(section);
      return NextResponse.json({ roster });
    }

    // Admin or explicit summary request
    if (summary || userRole === 'admin') {
      const data = await getManualAttendanceSummary();
      return NextResponse.json({ sessions: data });
    }

    const sessions = await getManualAttendanceByFaculty(userId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session  = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const body = await request.json();
    const { section, subject, date, records } = body;
    if (!section || !records?.length) {
      return NextResponse.json({ error: 'section and records are required' }, { status: 400 });
    }
    const facultyId = session?.user?.id;
    const result = await saveManualAttendance({ facultyId, section, subject, date: date || new Date(), records });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
