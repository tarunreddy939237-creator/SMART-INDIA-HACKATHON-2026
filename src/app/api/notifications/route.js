import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import Notification from '@/lib/models/Notification.js';

/**
 * GET /api/notifications
 * 
 * Query params:
 *   ?unread=true        — only unread
 *   ?filter=academic    — filter by category
 *   ?limit=20           — pagination limit (default 50)
 *   ?offset=0           — pagination offset
 *   ?countOnly=true     — only return unread count (fast)
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = session.user.id;
    const countOnly = searchParams.get('countOnly') === 'true';
    const unreadOnly = searchParams.get('unread') === 'true';
    const filter = searchParams.get('filter') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fast path: just count unread
    if (countOnly) {
      const unreadCount = await Notification.countDocuments({
        userId,
        isRead: false,
        isDismissed: false,
      });
      return NextResponse.json({ unreadCount });
    }

    // Build query
    const query = { userId, isDismissed: false };

    if (unreadOnly) {
      query.isRead = false;
    }

    // Filter by category
    const ACADEMIC_TYPES = [
      'ASSIGNMENT_NEW', 'ASSIGNMENT_DUE', 'ASSIGNMENT_OVERDUE',
      'QUIZ_NEW', 'QUIZ_REMINDER', 'QUIZ_RESULT',
      'EXAM_REMINDER', 'CLASS_REMINDER',
      'TASK_NEW', 'TASK_DUE', 'TASK_COMPLETED',
      'TEACHER_ANNOUNCEMENT',
    ];
    const AI_TYPES = ['WEAK_TOPIC', 'PERFORMANCE_DROP', 'PERFORMANCE_IMPROVEMENT', 'STUDY_RECOMMENDATION'];
    const EXAM_TYPES = ['EXAM_REMINDER'];
    const TASK_TYPES = ['TASK_NEW', 'TASK_DUE', 'TASK_COMPLETED', 'ASSIGNMENT_NEW', 'ASSIGNMENT_DUE'];

    if (filter === 'academic') {
      query.type = { $in: ACADEMIC_TYPES };
    } else if (filter === 'ai') {
      query.type = { $in: AI_TYPES };
    } else if (filter === 'exams') {
      query.type = { $in: EXAM_TYPES };
    } else if (filter === 'tasks') {
      query.type = { $in: TASK_TYPES };
    }

    // Fetch notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false, isDismissed: false });

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('[notifications] GET error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

/**
 * PUT /api/notifications
 * 
 * Body:
 *   { action: 'markRead', notificationId: '...' }
 *   { action: 'markAllRead' }
 *   { action: 'dismiss', notificationId: '...' }
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const userId = session.user.id;
    const body = await request.json();
    const { action, notificationId } = body;

    if (action === 'markRead' && notificationId) {
      await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isRead: true }
      );
      const unreadCount = await Notification.countDocuments({ userId, isRead: false, isDismissed: false });
      return NextResponse.json({ success: true, unreadCount });
    }

    if (action === 'markAllRead') {
      await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true }
      );
      return NextResponse.json({ success: true, unreadCount: 0 });
    }

    if (action === 'dismiss' && notificationId) {
      await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isDismissed: true }
      );
      const unreadCount = await Notification.countDocuments({ userId, isRead: false, isDismissed: false });
      return NextResponse.json({ success: true, unreadCount });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[notifications] PUT error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
