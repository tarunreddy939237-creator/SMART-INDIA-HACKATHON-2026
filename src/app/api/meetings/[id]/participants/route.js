import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Meeting from '@/lib/models/Meeting.js';
import MeetingParticipant from '@/lib/models/MeetingParticipant.js';

/**
 * GET /api/meetings/[id]/participants
 * Get participant list for a meeting.
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

    const participants = await MeetingParticipant.find({ meetingId: meeting._id })
      .sort({ userName: 1 })
      .lean();

    return NextResponse.json({
      participants,
      total: participants.length,
    });
  } catch (error) {
    console.error('[Participants] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}
