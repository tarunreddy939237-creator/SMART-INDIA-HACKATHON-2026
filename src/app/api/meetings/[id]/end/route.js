import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Meeting from '@/lib/models/Meeting.js';
import MeetingParticipant from '@/lib/models/MeetingParticipant.js';
import MeetingAttendanceSession from '@/lib/models/MeetingAttendanceSession.js';
import MeetingAttendance from '@/lib/models/MeetingAttendance.js';
import {
  calculateAttendancePercentage,
  classifyAttendance,
  getEffectiveDurationMinutes,
  buildAttendanceSummary,
} from '@/lib/meetingUtils.js';

/**
 * POST /api/meetings/[id]/end
 * End a meeting (host only).
 * Closes all active sessions, computes final attendance, generates summary.
 */
export async function POST(request, { params }) {
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

    // Only host or admin can end
    if (session.user.role !== 'admin' && String(meeting.hostId) !== session.user.id) {
      return NextResponse.json({ error: 'Only the host can end this meeting' }, { status: 403 });
    }

    if (meeting.status !== 'live' && meeting.status !== 'waiting') {
      return NextResponse.json({ error: 'Meeting is not active' }, { status: 400 });
    }

    const endTime = new Date();
    const meetingDurationMinutes = getEffectiveDurationMinutes(meeting);

    // Close all active sessions
    const activeSessions = await MeetingAttendanceSession.find({
      meetingId: meeting._id,
      leaveTime: null,
    });

    for (const sess of activeSessions) {
      sess.leaveTime = endTime;
      sess.duration = Math.floor((endTime - new Date(sess.joinTime)) / 1000);
      await sess.save();
    }

    // Recompute all attendance records
    const allAttendance = await MeetingAttendance.find({ meetingId: meeting._id });
    let presentCount = 0;
    let partialCount = 0;
    let absentCount = 0;
    let totalDurationSum = 0;
    let joinedCount = 0;

    for (const att of allAttendance) {
      // Recalculate total duration from sessions
      const sessions = await MeetingAttendanceSession.find({
        meetingId: meeting._id,
        userId: att.userId,
      }).lean();
      att.totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

      if (att.totalDuration > 0) {
        joinedCount++;
        totalDurationSum += att.totalDuration;
      }

      att.attendancePercentage = calculateAttendancePercentage(att.totalDuration, meetingDurationMinutes);
      att.attendanceStatus = classifyAttendance(att.attendancePercentage);
      att.lastLeaveTime = endTime;
      await att.save();

      if (att.attendanceStatus === 'present') presentCount++;
      else if (att.attendanceStatus === 'partial') partialCount++;
      else absentCount++;
    }

    // Mark participants who never joined as absent
    const allParticipants = await MeetingParticipant.find({ meetingId: meeting._id }).lean();
    for (const p of allParticipants) {
      const hasAttendance = allAttendance.find(a => String(a.userId) === String(p.userId));
      if (!hasAttendance) {
        await MeetingAttendance.create({
          meetingId: meeting._id,
          userId: p.userId,
          userName: p.userName,
          attendancePercentage: 0,
          attendanceStatus: 'absent',
          totalDuration: 0,
        });
        absentCount++;
      }
    }

    const totalInvited = allParticipants.length;
    const averageDuration = joinedCount > 0 ? Math.round(totalDurationSum / joinedCount / 60) : 0;
    const attendancePercentage = totalInvited > 0
      ? Math.round(((presentCount + partialCount * 0.5) / totalInvited) * 1000) / 10
      : 0;

    // Update meeting record
    meeting.status = 'completed';
    meeting.actualEndTime = endTime;
    meeting.totalInvited = totalInvited;
    meeting.totalJoined = joinedCount;
    meeting.presentCount = presentCount;
    meeting.partialCount = partialCount;
    meeting.absentCount = absentCount;
    meeting.averageAttendanceDuration = averageDuration;
    meeting.attendancePercentage = attendancePercentage;
    await meeting.save();

    // Build summary
    const allRecords = await MeetingAttendance.find({ meetingId: meeting._id }).lean();
    const summary = buildAttendanceSummary(meeting, allRecords);

    return NextResponse.json({
      message: 'Meeting ended',
      summary,
    });
  } catch (error) {
    console.error('[Meeting End] POST error:', error);
    return NextResponse.json({ error: 'Failed to end meeting' }, { status: 500 });
  }
}
