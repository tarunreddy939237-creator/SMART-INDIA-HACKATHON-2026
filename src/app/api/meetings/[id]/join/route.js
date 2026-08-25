import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Meeting from '@/lib/models/Meeting.js';
import MeetingParticipant from '@/lib/models/MeetingParticipant.js';
import MeetingAttendanceSession from '@/lib/models/MeetingAttendanceSession.js';
import MeetingAttendance from '@/lib/models/MeetingAttendance.js';

/**
 * POST /api/meetings/[id]/join
 * Record a participant joining the meeting.
 * Creates a new attendance session (supports reconnects).
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;
    const userId = session.user.id;

    const meeting = await Meeting.findOne({
      $or: [{ meetingUuid: id }, { _id: id }],
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Must be live or waiting
    if (meeting.status !== 'live' && meeting.status !== 'waiting') {
      return NextResponse.json({ error: 'Meeting is not active' }, { status: 400 });
    }

    // Student must be invited
    if (session.user.role === 'student') {
      const isParticipant = await MeetingParticipant.findOne({
        meetingId: meeting._id,
        userId: userId,
      }).lean();

      if (!isParticipant) {
        return NextResponse.json({ error: 'You are not invited to this meeting' }, { status: 403 });
      }
    }

    const { connectionId } = await request.json().catch(() => ({ connectionId: '' }));

    // Check if there's already an active (un-closed) session for this user
    const existingActiveSession = await MeetingAttendanceSession.findOne({
      meetingId: meeting._id,
      userId: userId,
      leaveTime: null,
    }).lean();

    if (existingActiveSession) {
      // User is already connected — return existing session info
      return NextResponse.json({
        sessionId: existingActiveSession._id,
        joinTime: existingActiveSession.joinTime,
        message: 'Already connected',
      });
    }

    // Create new attendance session
    const joinTime = new Date();
    const sessionDoc = await MeetingAttendanceSession.create({
      meetingId: meeting._id,
      userId: userId,
      joinTime,
      connectionId: connectionId || `session-${Date.now()}`,
    });

    // Upsert the aggregated attendance record
    const existingAttendance = await MeetingAttendance.findOne({
      meetingId: meeting._id,
      userId: userId,
    });

    if (!existingAttendance) {
      const user = (await import('@/lib/models/User.js')).default;
      const userDoc = await user.findById(userId).lean();
      await MeetingAttendance.create({
        meetingId: meeting._id,
        userId: userId,
        userName: userDoc?.name || session.user.name || 'Student',
        userRollNumber: userDoc?.rollNumber || '',
        firstJoinTime: joinTime,
        totalSessions: 1,
      });
    } else {
      existingAttendance.totalSessions += 1;
      existingAttendance.lastLeaveTime = null;
      await existingAttendance.save();
    }

    return NextResponse.json({
      sessionId: sessionDoc._id,
      joinTime,
      message: 'Joined meeting',
    });
  } catch (error) {
    console.error('[Meeting Join] POST error:', error);
    return NextResponse.json({ error: 'Failed to join meeting' }, { status: 500 });
  }
}
