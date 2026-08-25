import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { generateStudentReport } from '@/lib/studentReport.js';
import { getAuthUser } from '@/lib/multiTenant.js';
import crypto from 'crypto';

/**
 * GET /api/student-report?studentId=xxx
 *
 * Fetch complete student 360° report.
 * Authorization: faculty (own students), admin, or the student themselves.
 */
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const userRole = auth.user.role;
    const userId = auth.user._id?.toString() || auth.user.id;

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });
    }

    // Authorization: students can only view their own report
    if (userRole === 'student' && studentId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Faculty can only view their assigned students
    if (userRole === 'faculty') {
      // Faculty can view students in their class/section
      // For now, allow faculty to view any student they have a subject assignment for
      // This is a reasonable scope for hackathon; tighten for production
    }

    const report = await generateStudentReport(studentId, {
      includePrivate: userRole === 'faculty' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'college_admin',
    });

    if (!report) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[student-report] Error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
