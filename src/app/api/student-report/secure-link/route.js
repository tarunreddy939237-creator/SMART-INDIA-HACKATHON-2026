import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthUser } from '@/lib/multiTenant.js';
import connectToDatabase from '@/lib/mongodb.js';
import SecureReportLink from '@/lib/models/SecureReportLink.js';
import { generateStudentReport } from '@/lib/studentReport.js';

/**
 * POST /api/student-report/secure-link
 * Generate a secure, expiring report link.
 * Body: { studentId, purpose? }
 *
 * Only faculty/admin can generate links for others.
 * Students can generate links for themselves.
 */
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { studentId, purpose = 'direct' } = body;
    const userRole = auth.user.role;
    const userId = auth.user._id?.toString() || auth.user.id;

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });
    }

    // Authorization
    if (userRole === 'student' && studentId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    // Generate a cryptographically secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const link = await SecureReportLink.create({
      token,
      studentId,
      createdBy: userId,
      collegeId: auth.user.collegeId || null,
      expiresAt,
      maxViews: 10,
      purpose,
    });

    const baseUrl = process.env.FRONTEND_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const reportUrl = `${baseUrl}/parent/report/view?token=${token}`;

    return NextResponse.json({
      success: true,
      url: reportUrl,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[secure-link] Error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

/**
 * GET /api/student-report/secure-link?token=xxx
 * Access a report via secure token.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid link.' }, { status: 400 });
    }

    await connectToDatabase();

    const link = await SecureReportLink.findOne({ token, isActive: true }).lean();

    if (!link) {
      return NextResponse.json({ error: 'Invalid or expired report link.' }, { status: 404 });
    }

    // Check expiry
    if (new Date() > new Date(link.expiresAt)) {
      return NextResponse.json({ error: 'This report link has expired.' }, { status: 410 });
    }

    // Check view count
    if (link.viewCount >= link.maxViews) {
      return NextResponse.json({ error: 'This report link has reached its maximum views.' }, { status: 410 });
    }

    // Increment view count
    await SecureReportLink.updateOne(
      { _id: link._id },
      { $inc: { viewCount: 1 } }
    );

    // Generate the report
    const report = await generateStudentReport(link.studentId, {
      includePrivate: false,
      includeParentFeedback: true,
    });

    if (!report) {
      return NextResponse.json({ error: 'Student data not found.' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[secure-link] GET error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
