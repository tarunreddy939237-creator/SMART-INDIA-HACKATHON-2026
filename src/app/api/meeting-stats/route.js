import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Meeting from '@/lib/models/Meeting.js';
import MeetingAttendance from '@/lib/models/MeetingAttendance.js';
import MeetingParticipant from '@/lib/models/MeetingParticipant.js';

/**
 * GET /api/meeting-stats
 * Get meeting statistics for the current user.
 * Faculty: their own meetings.
 * Student: their attendance across all meetings.
 * Admin: platform-wide stats.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const userId = session.user.id;
    const userRole = session.user.role;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId'); // For admin viewing a specific student

    let stats = {};

    if (userRole === 'faculty') {
      const meetings = await Meeting.find({ hostId: userId }).lean();
      const completedMeetings = meetings.filter(m => m.status === 'completed');
      const upcomingMeetings = meetings.filter(m => m.status === 'scheduled' || m.status === 'waiting');
      const liveMeetings = meetings.filter(m => m.status === 'live');

      // Best/worst attendance
      const withAttendance = completedMeetings.filter(m => m.attendancePercentage > 0);
      const bestMeeting = withAttendance.sort((a, b) => b.attendancePercentage - a.attendancePercentage)[0];
      const worstMeeting = withAttendance.sort((a, b) => a.attendancePercentage - b.attendancePercentage)[0];

      const totalParticipants = await MeetingParticipant.countDocuments({
        meetingId: { $in: meetings.map(m => m._id) },
      });

      const avgAttendance = withAttendance.length > 0
        ? Math.round(withAttendance.reduce((s, m) => s + m.attendancePercentage, 0) / withAttendance.length * 10) / 10
        : 0;

      stats = {
        totalMeetings: meetings.length,
        completedMeetings: completedMeetings.length,
        upcomingMeetings: upcomingMeetings.length,
        liveMeetings: liveMeetings.length,
        cancelledMeetings: meetings.filter(m => m.status === 'cancelled').length,
        totalParticipants,
        averageAttendance: avgAttendance,
        bestAttendance: bestMeeting ? {
          title: bestMeeting.title,
          percentage: bestMeeting.attendancePercentage,
          date: bestMeeting.scheduledDate,
        } : null,
        worstAttendance: worstMeeting ? {
          title: worstMeeting.title,
          percentage: worstMeeting.attendancePercentage,
          date: worstMeeting.scheduledDate,
        } : null,
      };
    } else if (userRole === 'student') {
      // Student meeting attendance stats
      const targetUserId = studentId || userId;
      const attendanceRecords = await MeetingAttendance.find({ userId: targetUserId }).lean();
      const meetingsAttended = attendanceRecords.filter(a => a.attendanceStatus === 'present').length;
      const partialMeetings = attendanceRecords.filter(a => a.attendanceStatus === 'partial').length;
      const missedMeetings = attendanceRecords.filter(a => a.attendanceStatus === 'absent').length;

      const overallPercentage = attendanceRecords.length > 0
        ? Math.round(attendanceRecords.reduce((s, a) => s + a.attendancePercentage, 0) / attendanceRecords.length * 10) / 10
        : 0;

      // Find upcoming meetings this student is invited to
      const participantMeetings = await MeetingParticipant.find({ userId: targetUserId }).lean();
      const meetingIds = participantMeetings.map(p => p.meetingId);
      const upcomingMeetings = await Meeting.find({
        _id: { $in: meetingIds },
        status: { $in: ['scheduled', 'waiting'] },
      }).sort({ scheduledDate: 1 }).lean();

      stats = {
        totalMeetings: attendanceRecords.length,
        meetingsAttended,
        partialMeetings,
        missedMeetings,
        overallAttendance: overallPercentage,
        upcomingMeetings,
      };
    } else if (userRole === 'admin') {
      // Admin: platform-wide stats
      const allMeetings = await Meeting.find({}).lean();
      const completed = allMeetings.filter(m => m.status === 'completed');

      stats = {
        totalMeetings: allMeetings.length,
        completedMeetings: completed.length,
        upcomingMeetings: allMeetings.filter(m => m.status === 'scheduled').length,
        liveMeetings: allMeetings.filter(m => m.status === 'live').length,
        averageAttendance: completed.length > 0
          ? Math.round(completed.reduce((s, m) => s + (m.attendancePercentage || 0), 0) / completed.length * 10) / 10
          : 0,
        totalParticipants: await MeetingParticipant.countDocuments({}),
      };
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Meeting Stats] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
