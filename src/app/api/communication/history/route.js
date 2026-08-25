import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/multiTenant.js';
import connectToDatabase from '@/lib/mongodb.js';
import CommunicationLog from '@/lib/models/CommunicationLog.js';

/**
 * GET /api/communication/history?studentId=xxx&page=1&limit=20
 *
 * Fetch communication history for faculty/admin.
 * Can filter by studentId or show all for the admin's college.
 */
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const allowedRoles = ['faculty', 'admin', 'college_admin', 'super_admin'];
    if (!allowedRoles.includes(auth.user.role)) {
      return NextResponse.json({ error: 'Faculty access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50);

    await connectToDatabase();

    const query = {};
    if (studentId) {
      query.studentId = studentId;
    }

    // College scoping for college_admin
    if (auth.user.role === 'college_admin' && auth.user.collegeId) {
      query.collegeId = auth.user.collegeId;
    }

    const [logs, total] = await Promise.all([
      CommunicationLog.find(query)
        .populate('studentId', 'name rollNumber classOrSubject')
        .populate('sentBy', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommunicationLog.countDocuments(query),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[communication/history] Error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
