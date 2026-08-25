import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import AttendanceRecord from '@/lib/models/AttendanceRecord.js';

/**
 * GET /api/guardian-settings?studentId=xxx
 * Fetch guardian settings + recent alert log for a student.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userRole = session?.user?.role || 'student';
    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get('studentId');
    const targetId = requestedId || userId;

    if (!targetId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    // IDOR protection: students can only view their own guardian settings
    if (userRole === 'student' && requestedId && requestedId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({
        guardianContact: { name: 'Sunita Sharma', phone: '+919876543210', email: 'sunita@test.com', preferredChannel: 'whatsapp' },
        notifyOptIn: true,
        alertLog: [
          { date: new Date(Date.now() - 86400000 * 2).toISOString(), type: 'attendance_low', message: 'Attendance dropped below 75%', channel: 'whatsapp', status: 'sent' },
          { date: new Date(Date.now() - 86400000 * 5).toISOString(), type: 'risk_high', message: 'Risk level changed to High', channel: 'whatsapp', status: 'sent' },
        ],
      });
    }

    const user = await User.findById(targetId).select('guardianPhone guardianContact notifyOptIn').lean();
    if (!user) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    // Get recent alert log (attendance records with alertSentAt)
    const recentAlerts = await AttendanceRecord.find({
      studentId: targetId,
      alertSentAt: { $ne: null },
    })
      .sort({ alertSentAt: -1 })
      .limit(10)
      .select('date status alertSentAt')
      .lean();

    const alertLog = recentAlerts.map(a => ({
      date: a.alertSentAt,
      type: a.status === 'absent' ? 'attendance_absent' : 'attendance_low',
      message: `Alert sent — attendance ${a.status}`,
      channel: user.guardianContact?.preferredChannel || 'whatsapp',
      status: 'sent',
    }));

    return NextResponse.json({
      guardianContact: user.guardianContact || { name: '', phone: user.guardianPhone || '', email: '', preferredChannel: 'whatsapp' },
      notifyOptIn: user.notifyOptIn !== false,
      alertLog,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guardian settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/guardian-settings
 * Update guardian contact info and notification preferences.
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userRole = session?.user?.role || 'student';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { studentId, guardianContact, notifyOptIn } = body;
    const targetId = studentId || userId;

    // Faculty/admin can update any student; students can only update themselves
    if (userRole === 'student' && targetId !== userId) {
      return NextResponse.json({ error: 'Cannot modify another student\'s settings' }, { status: 403 });
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ success: true, guardianContact, notifyOptIn });
    }

    const update = {};
    if (guardianContact) update.guardianContact = guardianContact;
    if (notifyOptIn !== undefined) update.notifyOptIn = notifyOptIn;
    if (guardianContact?.phone) update.guardianPhone = guardianContact.phone;

    await User.findByIdAndUpdate(targetId, { $set: update });

    return NextResponse.json({ success: true, guardianContact, notifyOptIn });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to update guardian settings' },
      { status: 500 }
    );
  }
}
