import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { createNotice, getNoticesForStudent, getNoticesByFaculty } from '@/lib/queries.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const role      = session?.user?.role;
    const userId    = session?.user?.id;
    const studentId = searchParams.get('studentId');

    if (role === 'faculty' || role === 'admin') {
      // Faculty: get all notices they sent, or notices for a specific student
      if (studentId) {
        const notices = await getNoticesForStudent(studentId);
        return NextResponse.json({ notices });
      }
      const notices = await getNoticesByFaculty(userId);
      return NextResponse.json({ notices });
    }
    // Student: get their own notices
    const notices = await getNoticesForStudent(userId);
    return NextResponse.json({ notices });
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
    const { studentId, type, subject, message } = body;
    if (!studentId || !subject || !message) {
      return NextResponse.json({ error: 'studentId, subject and message are required' }, { status: 400 });
    }
    const facultyId = session?.user?.id;
    const notice = await createNotice({ studentId, facultyId, type, subject, message });
    return NextResponse.json({ success: true, notice });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
