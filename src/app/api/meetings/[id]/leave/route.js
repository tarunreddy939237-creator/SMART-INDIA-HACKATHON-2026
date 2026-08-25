import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Meeting from '@/lib/models/Meeting.js';
import MeetingAttendanceSession from '@/lib/models/MeetingAttendanceSession.js';
import MeetingAttendance from '@/lib/models/MeetingAttendance.js';
import {
  calculateAttendancePercentage,
  classifyAttendance,
  getEffectiveDurationMinutes,
} from '@/lib/meetingUtils.js';

/**
 * POST /api/meetings/[id]/leave
 * Record a participant leaving the meeting.
 * Closes the active session and updates aggregated attendance.
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

    // Close any active sessions for this user
    const leaveTime = new Date();
    const activeSessions = await MeetingAttendanceSession.find({
      meetingId: meeting._id,
      userId: userId,
      leaveTime: null,
    });

    let sessionDuration = 0;
    for (const sess of activeSessions) {
      sess.leaveTime = leaveTime;
      sess.duration = Math.floor((leaveTime - new Date(sess.joinTime)) / 1000);
      sessionDuration += sess.duration;
      await sess.save();
    }

    // Update aggregated attendance
    const attendance = await MeetingAttendance.findOne({
      meetingId: meeting._id,
      userId: userId,
    });

    if (attendance) {
      attendance.lastLeaveTime = leaveTime;
      // Recalculate total duration from all sessions
      const allSessions = await MeetingAttendanceSession.find({
        meetingId: meeting._id,
        userId: userId,
      }).lean();
      attendance.totalDuration = allSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

      // Calculate attendance percentage
      const meetingDurationMinutes = getEffectiveDurationMinutes(meeting);
      attendance.attendancePercentage = calculateAttendancePercentage(
        attendance.totalDuration,
        meetingDurationMinutes
      );
      attendance.attendanceStatus = classifyAttendance(attendance.attendancePercentage);
      await attendance.save();
    }

    return NextResponse.json({
      duration: sessionDuration,
      message: 'Left meeting',
    });
  } catch (error) {
    console.error('[Meeting Leave] POST error:', error);
    return NextResponse.json({ error: 'Failed to leave meeting' }, { status: 500 });
  }
}
