import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import AttendanceRecord from '@/lib/models/AttendanceRecord.js';

/**
 * GET /api/attendance-heatmap?section=CSE-A&days=90
 *
 * Returns an array of { date, pct, present, total, dayOfWeek } for each day
 * that has attendance records for the given section.
 * Days with no class held are excluded (not shown as 0%).
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'CSE-A';
    const days = Math.min(parseInt(searchParams.get('days') || '90', 10), 365);

    const db = await connectToDatabase();
    if (!db) {
      // Return demo heatmap data
      return NextResponse.json({ heatmap: generateDemoHeatmap(days) });
    }

    // Get all students in this section
    const students = await User.find({ role: 'student', classOrSubject: section }).lean();
    if (!students.length) return NextResponse.json({ heatmap: [] });

    const studentIds = students.map(u => u._id);
    const totalStudents = students.length;

    // Date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Aggregate attendance by date
    const raw = await AttendanceRecord.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] },
          },
          late: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const heatmap = raw.map((d) => {
      const dateObj = new Date(d._id + 'T00:00:00');
      const pct = d.total ? Math.round((d.present / d.total) * 100) : 0;
      return {
        date: d._id,
        dayOfWeek: DAY_LABELS[dateObj.getDay()],
        pct,
        present: d.present,
        late: d.late,
        total: d.total,
        totalStudents,
      };
    });

    return NextResponse.json({ heatmap, section, totalStudents });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to compute heatmap' },
      { status: 500 }
    );
  }
}

function generateDemoHeatmap(days) {
  const heatmap = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    // Random attendance between 70-98%
    const pct = Math.round(70 + Math.random() * 28);
    const total = 55 + Math.round(Math.random() * 5);
    const present = Math.round((pct / 100) * total);
    const dateStr = d.toISOString().slice(0, 10);
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    heatmap.push({
      date: dateStr,
      dayOfWeek: DAY_LABELS[dayOfWeek],
      pct,
      present,
      late: 0,
      total,
      totalStudents: total,
    });
  }
  return heatmap;
}
