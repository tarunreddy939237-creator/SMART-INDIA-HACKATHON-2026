import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/multiTenant.js';
import connectToDatabase from '@/lib/mongodb.js';
import ParentFeedback from '@/lib/models/ParentFeedback.js';

/**
 * POST /api/parent/feedback/respond
 * Faculty/admin responds to parent feedback.
 * Body: { feedbackId, response, status? }
 */
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const userRole = auth.user.role;
    const allowedRoles = ['faculty', 'admin', 'college_admin', 'super_admin'];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Faculty access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { feedbackId, response, status } = body;

    if (!feedbackId || !response) {
      return NextResponse.json({ error: 'feedbackId and response are required.' }, { status: 400 });
    }

    if (response.length > 2000) {
      return NextResponse.json({ error: 'Response must be 2000 characters or less.' }, { status: 400 });
    }

    await connectToDatabase();

    const feedback = await ParentFeedback.findById(feedbackId);
    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found.' }, { status: 404 });
    }

    // Update feedback
    feedback.facultyResponse = response.trim();
    feedback.respondedBy = auth.user._id;
    feedback.respondedAt = new Date();
    if (status && ['reviewed', 'responded', 'resolved'].includes(status)) {
      feedback.status = status;
    } else {
      feedback.status = 'responded';
    }
    await feedback.save();

    return NextResponse.json({
      success: true,
      message: 'Response submitted successfully.',
      feedback: {
        id: feedback._id,
        status: feedback.status,
        facultyResponse: feedback.facultyResponse,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[feedback/respond] Error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
