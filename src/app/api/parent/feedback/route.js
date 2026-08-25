import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/multiTenant.js';
import connectToDatabase from '@/lib/mongodb.js';
import ParentFeedback from '@/lib/models/ParentFeedback.js';
import User from '@/lib/models/User.js';
import { buildRateLimit } from '@/lib/rateLimit.js';

/**
 * GET /api/parent/feedback?studentId=xxx
 * Fetch feedback submitted by the logged-in parent.
 * Parents can only see their own feedback.
 */
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const userId = auth.user._id?.toString() || auth.user.id;
    const userRole = auth.user.role;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    await connectToDatabase();

    const query = {};

    // Parents can only see their own feedback
    if (userRole === 'student') {
      // Students are the "parents" of their own account for this feature
      query.studentId = userId;
    } else if (userRole === 'faculty' || userRole === 'admin' || userRole === 'college_admin' || userRole === 'super_admin') {
      // Faculty/admin can see all feedback for their students
      if (studentId) query.studentId = studentId;
      if (userRole === 'college_admin' && auth.user.collegeId) {
        query.collegeId = auth.user.collegeId;
      }
    } else {
      query.parentUserId = userId;
    }

    const feedback = await ParentFeedback.find(query)
      .populate('studentId', 'name rollNumber classOrSubject')
      .populate('respondedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ feedback });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[parent/feedback] GET error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

/**
 * POST /api/parent/feedback
 * Submit new feedback.
 * Body: { studentId, category, subject, message, priority? }
 */
export async function POST(request) {
  // Rate limit: 5 feedback submissions per hour
  const { result: rl } = buildRateLimit(request, 'parent-feedback', {
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many feedback submissions. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const userId = auth.user._id?.toString() || auth.user.id;
    const body = await request.json();
    const { studentId, category, subject, message, priority = 'medium' } = body;

    // Validation
    if (!studentId || !category || !subject || !message) {
      return NextResponse.json({ error: 'studentId, category, subject, and message are required.' }, { status: 400 });
    }

    const validCategories = ['academic', 'attendance', 'behaviour', 'infrastructure', 'general'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
    }

    if (subject.length > 200) {
      return NextResponse.json({ error: 'Subject must be 200 characters or less.' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message must be 2000 characters or less.' }, { status: 400 });
    }

    // Verify the student exists
    await connectToDatabase();
    const student = await User.findById(studentId).lean();
    if (!student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    const feedback = await ParentFeedback.create({
      parentUserId: userId,
      studentId,
      collegeId: auth.user.collegeId || student.collegeId || null,
      category,
      subject: subject.trim(),
      message: message.trim(),
      priority,
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully.',
      feedback: {
        id: feedback._id,
        status: feedback.status,
        createdAt: feedback.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[parent/feedback] POST error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
