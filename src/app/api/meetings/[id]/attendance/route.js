import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Meeting from '@/lib/models/Meeting.js';
import MeetingAttendance from '@/lib/models/MeetingAttendance.js';
import { buildAttendanceSummary, formatDuration } from '@/lib/meetingUtils.js';

/**
 * GET /api/meetings/[id]/attendance
 * Get attendance report for a meeting.
 * Faculty/admin can see all. Student can only see their own.
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;

    const meeting = await Meeting.findOne({
      $or: [{ meetingUuid: id }, { _id: id }],
    }).lean();

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const userRole = session.user.role;
    const userId = session.user.id;

    if (userRole === 'student') {
      // Students can only see their own attendance
      const myAttendance = await MeetingAttendance.findOne({
        meetingId: meeting._id,
        userId: userId,
      }).lean();

      return NextResponse.json({
        meeting: {
          _id: meeting._id,
          title: meeting.title,
          scheduledDate: meeting.scheduledDate,
          status: meeting.status,
        },
        myAttendance: myAttendance || null,
        summary: null,
        allAttendance: [],
      });
    }

    // Faculty/admin can see all attendance
    const allAttendance = await MeetingAttendance.find({ meetingId: meeting._id })
      .sort({ attendancePercentage: -1 })
      .lean();

    const summary = buildAttendanceSummary(meeting, allAttendance);

    return NextResponse.json({
      meeting,
      summary,
      allAttendance: allAttendance.map(a => ({
        ...a,
        durationFormatted: formatDuration(a.totalDuration),
      })),
    });
  } catch (error) {
    console.error('[Meeting Attendance] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}
