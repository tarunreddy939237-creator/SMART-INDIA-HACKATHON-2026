import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import AttendanceRecord from '@/lib/models/AttendanceRecord.js';
import QuizAttempt from '@/lib/models/QuizAttempt.js';
import StudentScore from '@/lib/models/StudentScore.js';
import { batchPredictRisk } from '@/lib/riskPredictor.js';
import { batchRecalculate } from '@/lib/successScoreEngine.js';

// In-memory fallback for demo (no DB)
const DEMO_RISK = [
  { studentId: '64f1a2b3c4d5e6f7a8b9c001', name: 'Aarav Sharma',  attendancePct: 94, riskTier: 'Low',    riskScore: 5,  riskReasons: ['All indicators within normal range'],                                                          successScore: 88, trend: 'stable'   },
  { studentId: '64f1a2b3c4d5e6f7a8b9c002', name: 'Diya Patel',    attendancePct: 92, riskTier: 'Low',    riskScore: 8,  riskReasons: ['All indicators within normal range'],                                                          successScore: 85, trend: 'stable'   },
  { studentId: '64f1a2b3c4d5e6f7a8b9c003', name: 'Rohan Verma',   attendancePct: 68, riskTier: 'High',   riskScore: 72, riskReasons: ['Attendance is 68% — below the 75% minimum threshold', 'Quiz scores declining: 80% → 58%'], successScore: 28, trend: 'declining' },
];

export async function GET(request) {
  try {
    const session  = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userRole = session.user.role;

    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const classFilter = searchParams.get('class') || 'CSE-A';

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ students: DEMO_RISK });
    }

    // 1. Get all students in the class
    const students = await User.find({ role: 'student', classOrSubject: classFilter }).lean();
    if (!students.length) return NextResponse.json({ students: [] });

    const studentIds = students.map(u => u._id);

    // 2. Load stored StudentScore records
    const storedScores = await StudentScore.find({ studentId: { $in: studentIds } }).lean();
    const scoreMap = new Map(storedScores.map(s => [String(s.studentId), s]));

    // 3. Find students with no stored score and trigger a background recalculation
    const missingIds = students
      .filter(u => !scoreMap.has(String(u._id)))
      .map(u => String(u._id));
    if (missingIds.length) {
      batchRecalculate(missingIds).catch(() => {});
    }

    // 4. For students with no stored score yet, compute on-the-fly as fallback
    const now          = new Date();
    const twoWeeksAgo  = new Date(now - 14 * 86400000);
    const fourWeeksAgo = new Date(now - 28 * 86400000);

    const results = await Promise.all(students.map(async (u) => {
      const stored = scoreMap.get(String(u._id));

      if (stored) {
        // Use stored score — fast path
        return {
          studentId:      String(u._id),
          name:           u.name,
          email:          u.email,
          classOrSubject: u.classOrSubject,
          attendancePct:  stored.breakdown?.attendance ?? 0,
          avgQuizScore:   stored.breakdown?.academic   ?? 0,
          successScore:   stored.successScore,
          riskTier:       stored.riskTier,
          riskScore:      stored.riskScore,
          riskReasons:    stored.riskFactors,
          structuredFactors: stored.structuredFactors ?? [],
          trend:          stored.trend,
          history:        stored.history ?? [],
          breakdown:      stored.breakdown,
        };
      }

      // Fallback: compute on-the-fly for students not yet scored
      const allAtt  = await AttendanceRecord.find({ studentId: u._id }).sort({ date: -1 }).lean();
      const recent  = allAtt.filter(a => new Date(a.date) >= twoWeeksAgo);
      const prev    = allAtt.filter(a => new Date(a.date) >= fourWeeksAgo && new Date(a.date) < twoWeeksAgo);

      const pct2w   = recent.length ? Math.round(recent.filter(a => a.status === 'present').length / recent.length * 100) : 90;
      const pctPrev = prev.length   ? Math.round(prev.filter(a => a.status === 'present').length   / prev.length   * 100) : 90;

      const attempts = await QuizAttempt.find({ studentId: u._id }).sort({ createdAt: -1 }).limit(3).lean();
      const scores   = attempts.reverse().map(q => q.score);

      const presentDays = new Set(recent.filter(a => a.status === 'present').map(a => new Date(a.date).toDateString()));
      let streakBreaks = 0;
      for (let i = 0; i < 14; i++) {
        if (!presentDays.has(new Date(now - i * 86400000).toDateString())) streakBreaks++;
      }

      const [predicted] = batchPredictRisk([{
        studentId:              String(u._id),
        name:                   u.name,
        email:                  u.email,
        classOrSubject:         u.classOrSubject,
        attendancePct:          pct2w,
        attendancePct2w:        pct2w,
        attendancePctPrev:      pctPrev,
        lastThreeQuizScores:    scores,
        streakBreaksLast14Days: streakBreaks,
      }]);

      return {
        studentId:      String(u._id),
        name:           u.name,
        email:          u.email,
        classOrSubject: u.classOrSubject,
        attendancePct:  pct2w,
        avgQuizScore:   scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        successScore:   null,
        riskTier:       predicted.riskTier,
        riskScore:      predicted.riskScore,
        riskReasons:    predicted.riskReasons,
        structuredFactors: predicted.factors ?? [],
        trend:          'stable',
        history:        [],
        breakdown:      null,
      };
    }));

    return NextResponse.json({ students: results });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
