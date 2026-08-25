import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import ChangeFeed from '@/lib/models/ChangeFeed.js';
import User from '@/lib/models/User.js';
import AcademicEvent from '@/lib/models/AcademicEvent.js';
import { parseClassOrSubject } from '@/lib/targeting.js';

/**
 * GET /api/realtime?since=<ISO timestamp>
 *
 * Returns new academic events targeting this student since their last poll.
 * Students should poll every 15-30 seconds when active.
 *
 * Response shape:
 * {
 *   events: [{ type, eventId, title, eventType, date, subject, priority }],
 *   lastTimestamp: ISO string,
 *   count: number
 * }
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    await connectToDatabase();

    const student = await User.findById(session.user.id).lean();
    if (!student) {
      return NextResponse.json({ events: [], lastTimestamp: new Date().toISOString(), count: 0 });
    }

    const { branch: studentBranch, section: studentSection } = parseClassOrSubject(student.classOrSubject);

    // Build query for matching change events
    const query = {
      timestamp: { $gt: since ? new Date(since) : new Date(Date.now() - 3600000) }, // last 1 hour if no since
    };

    // Server-side audience filtering
    query.$or = [
      // Events targeting this student's section directly
      { 'targetAudience.section': studentSection },
      // Events targeting this student's branch (any section)
      { 'targetAudience.branch': studentBranch, 'targetAudience.section': { $in: ['', null] } },
      // Untargeted events (empty targeting = all students)
      {
        'targetAudience.branch': { $in: ['', null] },
        'targetAudience.section': { $in: ['', null] },
        'targetAudience.studentIds': { $size: 0 },
      },
      // Events targeting this specific student
      { 'targetAudience.studentIds': session.user.id },
    ];

    const changes = await ChangeFeed.find(query)
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    // Enrich with entity data
    const enriched = await Promise.all(changes.map(async (c) => {
      let entityData = {};
      try {
        if (c.entityModel === 'AcademicEvent') {
          const event = await AcademicEvent.findById(c.entityId).lean();
          if (event) {
            entityData = {
              title: event.title,
              eventType: event.eventType,
              date: event.date,
              subject: event.subject,
              priority: event.priority,
              description: event.description,
              venue: event.venue,
              startTime: event.startTime,
              endTime: event.endTime,
            };
          }
        }
      } catch { /* ignore */ }

      return {
        type: c.eventType,
        eventId: c.entityId,
        timestamp: c.timestamp,
        data: { ...c.data, ...entityData },
      };
    }));

    return NextResponse.json({
      events: enriched,
      lastTimestamp: changes.length > 0 ? changes[0].timestamp : new Date().toISOString(),
      count: enriched.length,
    });
  } catch (error) {
    console.error('[realtime] GET error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
