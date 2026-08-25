import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Meeting from '@/lib/models/Meeting.js';
import MeetingParticipant from '@/lib/models/MeetingParticipant.js';
import MeetingAttendance from '@/lib/models/MeetingAttendance.js';
import User from '@/lib/models/User.js';

/**
 * GET /api/meetings/[id]
 * Get meeting details by ID or meetingUuid.
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;

    // Try meetingUuid first, then _id
    let meeting = await Meeting.findOne({ meetingUuid: id }).lean();
    if (!meeting) {
      meeting = await Meeting.findById(id).lean();
    }

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Authorization check
    const userId = session.user.id;
    const userRole = session.user.role;

    if (userRole === 'faculty' && String(meeting.hostId) !== userId) {
      // Faculty can only see their own meetings (unless admin)
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (userRole === 'student') {
      // Students can only see meetings they're invited to
      const isParticipant = await MeetingParticipant.findOne({
        meetingId: meeting._id,
        userId: userId,
      }).lean();

      if (!isParticipant) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get participant list
    const participants = await MeetingParticipant.find({ meetingId: meeting._id })
      .sort({ invitedAt: 1 })
      .lean();

    // Get live attendance if meeting is live or completed
    let attendance = [];
    if (meeting.status === 'live' || meeting.status === 'completed') {
      attendance = await MeetingAttendance.find({ meetingId: meeting._id })
        .sort({ attendancePercentage: -1 })
        .lean();
    }

    // Get the current user's attendance if student
    let myAttendance = null;
    if (userRole === 'student') {
      myAttendance = await MeetingAttendance.findOne({
        meetingId: meeting._id,
        userId: userId,
      }).lean();
    }

    return NextResponse.json({
      meeting,
      participants,
      attendance,
      myAttendance,
    });
  } catch (error) {
    console.error('[Meeting Detail] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
  }
}

/**
 * PATCH /api/meetings/[id]
 * Update meeting details (host only).
 */
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;

    const meeting = await Meeting.findOne({
      $or: [{ meetingUuid: id }, { _id: id }],
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Only host or admin can update
    if (session.user.role !== 'admin' && String(meeting.hostId) !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = [
      'title', 'description', 'agenda', 'scheduledDate', 'scheduledStartTime',
      'expectedDuration', 'status', 'visibility', 'allowStudentScreenShare',
      'enableRecording', 'actualStartTime', 'actualEndTime',
      'totalInvited', 'totalJoined', 'presentCount', 'partialCount',
      'absentCount', 'averageAttendanceDuration', 'attendancePercentage',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        meeting[field] = body[field];
      }
    }

    await meeting.save();

    return NextResponse.json({ meeting, message: 'Meeting updated' });
  } catch (error) {
    console.error('[Meeting Detail] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
  }
}

/**
 * DELETE /api/meetings/[id]
 * Cancel a meeting (host only, only if scheduled).
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;

    const meeting = await Meeting.findOne({
      $or: [{ meetingUuid: id }, { _id: id }],
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (session.user.role !== 'admin' && String(meeting.hostId) !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (meeting.status === 'live') {
      return NextResponse.json({ error: 'Cannot cancel a live meeting. End it instead.' }, { status: 400 });
    }

    meeting.status = 'cancelled';
    await meeting.save();

    // Notify participants
    try {
      const Notification = (await import('@/lib/models/Notification.js')).default;
      const participants = await MeetingParticipant.find({ meetingId: meeting._id }).lean();
      const notifications = participants.map(p =>
        new Notification({
          userId: p.userId,
          title: 'Meeting Cancelled',
          message: `Meeting "${meeting.title}" has been cancelled.`,
          type: 'meeting',
          metadata: { meetingId: meeting._id },
        }).save()
      );
      await Promise.allSettled(notifications);
    } catch (e) { /* notification failure is non-critical */ }

    return NextResponse.json({ message: 'Meeting cancelled' });
  } catch (error) {
    console.error('[Meeting Detail] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to cancel meeting' }, { status: 500 });
  }
}
