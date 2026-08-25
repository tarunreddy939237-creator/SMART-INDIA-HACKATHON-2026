import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import AttendanceAnomaly from '@/lib/models/AttendanceAnomaly.js';
import User from '@/lib/models/User.js';

/**
 * GET /api/attendance-anomalies?section=CSE-A&resolved=false
 * Fetch anomalies for a given section. Faculty/admin only.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || '';
    const resolved = searchParams.get('resolved');

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ anomalies: getDemoAnomalies() });
    }

    const filter = {};
    if (resolved !== null && resolved !== undefined) {
      filter.resolved = resolved === 'true';
    }

    const anomalies = await AttendanceAnomaly.find(filter)
      .populate('studentId', 'name email classOrSubject')
      .populate('resolvedBy', 'name')
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    // Filter by section if provided
    const filtered = section
      ? anomalies.filter(a => a.expectedSection === section || a.actualSession === section)
      : anomalies;

    return NextResponse.json({ anomalies: filtered });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch anomalies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attendance-anomalies
 * Log a new anomaly (called from attendance submission when mismatch detected).
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, expectedSection, actualSession, confidence } = body;

    if (!studentId || !expectedSection || !actualSession) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ success: true, anomaly: { _id: 'demo_anomaly_' + Date.now(), ...body, timestamp: new Date() } });
    }

    const anomaly = new AttendanceAnomaly({
      studentId,
      expectedSection,
      actualSession,
      confidence: confidence || 0,
      timestamp: new Date(),
    });
    await anomaly.save();

    return NextResponse.json({ success: true, anomaly });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to log anomaly' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/attendance-anomalies
 * Resolve an anomaly (faculty override).
 */
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { anomalyId, resolved, notes } = body;
    const userId = session?.user?.id;

    if (!anomalyId) {
      return NextResponse.json({ error: 'anomalyId required' }, { status: 400 });
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ success: true });
    }

    const update = { resolved: resolved !== false };
    if (resolved !== false) {
      update.resolvedBy = userId;
      update.resolvedAt = new Date();
    }
    if (notes) update.notes = notes;

    await AttendanceAnomaly.findByIdAndUpdate(anomalyId, { $set: update });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to resolve anomaly' },
      { status: 500 }
    );
  }
}

function getDemoAnomalies() {
  return [
    {
      _id: 'anomaly_demo_1',
      studentId: { name: 'Rohan Verma', email: 'rohan@test.com', classOrSubject: 'CSE-B' },
      expectedSection: 'CSE-B',
      actualSession: 'CSE-A',
      confidence: 87,
      timestamp: new Date(Date.now() - 3600000),
      resolved: false,
    },
    {
      _id: 'anomaly_demo_2',
      studentId: { name: 'Priya Singh', email: 'priya@test.com', classOrSubject: 'ECE-A' },
      expectedSection: 'ECE-A',
      actualSession: 'CSE-A',
      confidence: 92,
      timestamp: new Date(Date.now() - 7200000),
      resolved: true,
      resolvedBy: { name: 'Dr. Priya Nair' },
      resolvedAt: new Date(Date.now() - 6000000),
      notes: 'Cross-enrolled student — verified with department',
    },
  ];
}
