import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import AcademicEvent from '@/lib/models/AcademicEvent.js';
import User from '@/lib/models/User.js';
import { buildTargetAudience, validateFacultyTarget, matchesTargetAudience, parseClassOrSubject, describeTargetAudience, buildTargetAudienceQuery } from '@/lib/targeting.js';
import { onAcademicEventCreated } from '@/lib/notificationEngine.js';

// ── GET: Fetch events (server-side targeted) ──────────────────────────────
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = session.user.role;
    const month = searchParams.get('month');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const upcoming = searchParams.get('upcoming');
    const eventType = searchParams.get('eventType');
    const subject = searchParams.get('subject');
    const search = searchParams.get('search');

    await connectToDatabase();

    const query = { isActive: true };

    if (role === 'faculty') {
      query.createdBy = session.user.id;
    } else if (role === 'student') {
      // SERVER-SIDE TARGETING: Only show events matching this student
      const student = await User.findById(session.user.id).lean();
      if (!student) {
        return NextResponse.json({ events: [] });
      }

      const { branch: studentBranch, section: studentSection } = parseClassOrSubject(student.classOrSubject);
      const studentSubjects = [...(student.subjects || []), ...(student.labs || [])];

      query.$or = [
        // Events with structured targeting that match this student
        {
          'targetAudience.branch': { $in: ['', studentBranch] },
          'targetAudience.section': { $in: ['', studentSection] },
        },
        // Legacy section targeting
        { targetSections: { $in: [studentSection, ''] } },
        { section: studentSection },
        // Untargeted events (empty targeting = visible to all)
        {
          $and: [
            { 'targetAudience.branch': { $in: ['', null, undefined] } },
            { 'targetAudience.section': { $in: ['', null, undefined] } },
            { targetSections: { $size: 0 } },
            { section: '' },
          ],
        },
      ];

      // Also match events targeting specific student IDs
      query.$or.push({ 'targetAudience.studentIds': session.user.id });
    }

    // Date filters
    if (month) {
      const [y, m] = month.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      query.date = { $gte: start, $lte: end };
    } else if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    } else if (upcoming === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const future = new Date(today);
      future.setDate(future.getDate() + 90);
      query.date = { $gte: today, $lte: future };
    }

    if (eventType) query.eventType = eventType;
    if (subject) query.subject = subject;

    const events = await AcademicEvent.find(query)
      .sort({ date: 1 })
      .populate('createdBy', 'name')
      .lean();

    // Text search filter
    let filtered = events;
    if (search) {
      const q = search.toLowerCase();
      filtered = events.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ events: filtered });
  } catch (error) {
    console.error('[academic-events] GET error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// ── POST: Create / Update / Delete with authorization ─────────────────────
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'faculty' && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Faculty or Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    await connectToDatabase();

    // ── Create event with targeted audience ──
    if (action === 'create') {
      const { title, description, eventType, priority, date, startTime, endTime,
              subject, section, venue, targetSections, attachments, targetAudience } = body;

      if (!title || !eventType || !date) {
        return NextResponse.json({ error: 'title, eventType, and date are required' }, { status: 400 });
      }

      // Build structured target audience
      const audience = buildTargetAudience(targetAudience || {});

      // SERVER-SIDE FACULTY AUTHORIZATION
      const faculty = await User.findById(session.user.id).lean();
      if (!faculty) {
        return NextResponse.json({ error: 'Faculty not found' }, { status: 404 });
      }

      const auth = validateFacultyTarget(faculty, audience);
      if (!auth.valid) {
        return NextResponse.json({ error: auth.error }, { status: 403 });
      }

      // Count matching students for confirmation
      const studentQuery = { role: 'student' };
      if (audience.branch || audience.section) {
        const targetQuery = buildTargetAudienceQuery(audience);
        Object.assign(studentQuery, targetQuery);
      }
      const matchingCount = await User.countDocuments(studentQuery);

      const event = await AcademicEvent.create({
        createdBy: session.user.id,
        title,
        description: description || '',
        eventType,
        priority: priority || 'normal',
        date: new Date(date),
        startTime: startTime || '',
        endTime: endTime || '',
        subject: subject || '',
        section: section || '',
        venue: venue || '',
        targetSections: targetSections || [],
        targetAudience: audience,
        attachments: attachments || [],
      });

      // Record the event for real-time polling
      await recordRealTimeEvent({
        type: 'academic_event_created',
        eventId: event._id,
        targetAudience: audience,
        createdBy: session.user.id,
        data: { title, eventType, date, subject },
      });

      // Generate notifications for matching students
      try {
        const matchingStudents = await User.find(studentQuery).select('_id').lean();
        const studentIds = matchingStudents.map(s => s._id);
        await onAcademicEventCreated(event, studentIds);
      } catch (notifErr) {
        console.warn('[academic-events] Notification generation failed:', notifErr.message);
      }

      return NextResponse.json({
        success: true,
        event,
        targetDescription: describeTargetAudience(audience),
        matchingStudents: matchingCount,
      });
    }

    // ── Update event ──
    if (action === 'update') {
      const { eventId, targetAudience: newAudience, ...updates } = body;
      if (!eventId) {
        return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
      }

      // Validate faculty authorization for new audience if provided
      if (newAudience) {
        const faculty = await User.findById(session.user.id).lean();
        const audience = buildTargetAudience(newAudience);
        const auth = validateFacultyTarget(faculty, audience);
        if (!auth.valid) {
          return NextResponse.json({ error: auth.error }, { status: 403 });
        }
        updates.targetAudience = audience;
      }

      const event = await AcademicEvent.findOneAndUpdate(
        { _id: eventId, createdBy: session.user.id },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!event) {
        return NextResponse.json({ error: 'Event not found or unauthorized' }, { status: 404 });
      }

      // Record update for real-time
      await recordRealTimeEvent({
        type: 'academic_event_updated',
        eventId: event._id,
        targetAudience: event.targetAudience,
        createdBy: session.user.id,
        data: { title: event.title, changes: Object.keys(updates) },
      });

      return NextResponse.json({ success: true, event });
    }

    // ── Delete event (soft) ──
    if (action === 'delete') {
      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
      }

      const event = await AcademicEvent.findOneAndUpdate(
        { _id: eventId, createdBy: session.user.id },
        { $set: { isActive: false } }
      );

      if (!event) {
        return NextResponse.json({ error: 'Event not found or unauthorized' }, { status: 404 });
      }

      // Record deletion for real-time
      await recordRealTimeEvent({
        type: 'academic_event_deleted',
        eventId: event._id,
        targetAudience: event.targetAudience,
        createdBy: session.user.id,
        data: { title: event.title },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[academic-events] POST error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// ── Real-time event recording ─────────────────────────────────────────────
// Simple polling-based real-time: store events in a time-windowed collection
async function recordRealTimeEvent(event) {
  try {
    const db = await connectToDatabase();
    if (!db) return;

    // Store in a lightweight change-feed collection
    const ChangeFeed = (await import('@/lib/models/ChangeFeed.js')).default;
    await ChangeFeed.create({
      eventType: event.type,
      entityId: event.eventId,
      entityModel: 'AcademicEvent',
      targetAudience: event.targetAudience,
      createdBy: event.createdBy,
      data: event.data,
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn('[realtime] Failed to record event:', err.message);
  }
}
