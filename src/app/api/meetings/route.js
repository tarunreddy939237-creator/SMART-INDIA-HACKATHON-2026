import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Meeting from '@/lib/models/Meeting.js';
import MeetingParticipant from '@/lib/models/MeetingParticipant.js';
import User from '@/lib/models/User.js';
import { generateMeetingUuid } from '@/lib/meetingUtils.js';

/**
 * GET /api/meetings
 * List meetings for the current user based on role.
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
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    let query = {};

    if (userRole === 'admin') {
      // Admin sees all meetings
      query = {};
    } else if (userRole === 'faculty') {
      // Faculty sees meetings they host
      query.hostId = userId;
    } else {
      // Student sees meetings where they are invited
      const participantMeetings = await MeetingParticipant.find({
        userId: userId,
        invitationStatus: { $in: ['invited', 'accepted', 'pending'] },
      }).select('meetingId').lean();
      const meetingIds = participantMeetings.map(p => p.meetingId);

      // Also include class-based meetings targeting this student
      const student = await User.findById(userId).lean();
      const classQuery = {
        status: { $ne: 'cancelled' },
      };
      if (student?.branch) classQuery.branch = student.branch;
      if (student?.year) classQuery.year = student.year;
      if (student?.section) classQuery.section = student.section;

      const classMeetings = await Meeting.find(classQuery).select('_id').lean();

      // Combine both sets
      const allMeetingIds = [
        ...new Set([...meetingIds.map(String), ...classMeetings.map(m => String(m._id))]),
      ];

      if (allMeetingIds.length === 0) {
        return NextResponse.json({ meetings: [], total: 0, page, limit });
      }

      query._id = { $in: allMeetingIds };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const [meetings, total] = await Promise.all([
      Meeting.find(query)
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Meeting.countDocuments(query),
    ]);

    // For each meeting, get participant count
    const meetingsWithParticipants = await Promise.all(
      meetings.map(async (m) => {
        const participantCount = await MeetingParticipant.countDocuments({ meetingId: m._id });
        return { ...m, participantCount };
      })
    );

    return NextResponse.json({
      meetings: meetingsWithParticipants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[Meetings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

/**
 * POST /api/meetings
 * Create a new meeting (faculty/admin only).
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'faculty' && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Only faculty can create meetings' }, { status: 403 });
    }

    await connectToDatabase();

    const body = await request.json();
    const {
      title, description, agenda, scheduledDate, scheduledStartTime,
      expectedDuration, branch, year, semester, section, classOrSubject,
      visibility, targetStudentIds, allowStudentScreenShare, enableRecording,
    } = body;

    // Validation
    if (!title || !scheduledDate || !scheduledStartTime) {
      return NextResponse.json({ error: 'Title, date, and start time are required' }, { status: 400 });
    }

    const host = await User.findById(session.user.id).lean();
    if (!host) {
      return NextResponse.json({ error: 'Host not found' }, { status: 404 });
    }

    // Create meeting
    const meeting = new Meeting({
      meetingUuid: generateMeetingUuid(),
      title: title.trim(),
      description: (description || '').trim(),
      agenda: (agenda || '').trim(),
      hostId: session.user.id,
      hostName: host.name || 'Faculty',
      classOrSubject: classOrSubject || '',
      branch: branch || host.branch || '',
      year: year || host.year || '',
      semester: semester || '',
      section: section || '',
      scheduledDate: new Date(scheduledDate),
      scheduledStartTime,
      expectedDuration: parseInt(expectedDuration) || 60,
      status: 'scheduled',
      visibility: visibility || 'class',
      targetStudentIds: visibility === 'specific' ? (targetStudentIds || []) : [],
      allowStudentScreenShare: allowStudentScreenShare || false,
      enableRecording: enableRecording || false,
    });

    await meeting.save();

    // Auto-invite relevant students
    let studentQuery = {
      role: 'student',
      accountStatus: 'active',
    };

    if (visibility === 'specific' && targetStudentIds?.length > 0) {
      studentQuery._id = { $in: targetStudentIds };
    } else {
      // Class-based: invite students matching branch/year/section
      if (branch) studentQuery.branch = branch;
      if (year) studentQuery.year = year;
      if (section) studentQuery.section = section;
    }

    const students = await User.find(studentQuery)
      .select('_id name rollNumber')
      .lean();

    // Create participant records
    if (students.length > 0) {
      const participantDocs = students.map(s => ({
        meetingId: meeting._id,
        userId: s._id,
        userName: s.name,
        userRole: 'student',
        invitationStatus: 'invited',
      }));

      // Use insertMany with ordered: false to handle duplicates gracefully
      await MeetingParticipant.insertMany(participantDocs, { ordered: false }).catch(() => {
        // Ignore duplicate key errors (participant already invited)
      });

      // Update total invited count
      meeting.totalInvited = students.length;
      await meeting.save();
    }

    // Create notifications for invited students
    try {
      const Notification = (await import('@/lib/models/Notification.js')).default;
      const notificationPromises = students.map(s =>
        new Notification({
          userId: s._id,
          title: 'Meeting Scheduled',
          message: `You have been invited to "${meeting.title}" by ${meeting.hostName} on ${new Date(scheduledDate).toLocaleDateString()} at ${scheduledStartTime}`,
          type: 'meeting',
          metadata: { meetingId: meeting._id, meetingUuid: meeting.meetingUuid },
        }).save()
      );
      await Promise.allSettled(notificationPromises);
    } catch (notifErr) {
      console.error('[Meeting] Notification error:', notifErr);
    }

    return NextResponse.json({
      meeting: {
        _id: meeting._id,
        meetingUuid: meeting.meetingUuid,
        title: meeting.title,
        status: meeting.status,
        scheduledDate: meeting.scheduledDate,
        scheduledStartTime: meeting.scheduledStartTime,
        expectedDuration: meeting.expectedDuration,
        totalInvited: meeting.totalInvited,
      },
      message: 'Meeting created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[Meetings] POST error:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
