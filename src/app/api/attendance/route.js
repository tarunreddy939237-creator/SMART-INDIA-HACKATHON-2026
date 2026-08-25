import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import {
  getAttendanceByStudent,
  getAttendanceForFaculty,
  createAttendanceRecord,
  getClassRoster,
} from '@/lib/queries.js';
import connectToDatabase from '@/lib/mongodb.js';
import AttendanceRecord from '@/lib/models/AttendanceRecord.js';
import User from '@/lib/models/User.js';
import QuizAttempt from '@/lib/models/QuizAttempt.js';
import { batchPredictRisk } from '@/lib/riskPredictor.js';
import { sendAttendanceAlerts } from '@/lib/alertService.js';
import { batchRecalculate } from '@/lib/successScoreEngine.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const rosterClass = searchParams.get('roster');

    if (rosterClass) {
      const roster = await getClassRoster(rosterClass);
      return NextResponse.json({ roster });
    }

    // ── 7-day attendance trend for a class section ──────────────────────────
    const trendClass = searchParams.get('trend');

    // ── 7-day per-student attendance trend ─────────────────────────────────
    if (trendClass === 'STUDENT') {
      const sid = session?.user?.id;
      const db = await connectToDatabase();
      if (!db) return NextResponse.json({ trend: [] });
      try {
        const sevenDaysAgo = new Date(Date.now() - 6 * 86400000);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const raw = await AttendanceRecord.aggregate([
          { $match: { studentId: new mongoose.Types.ObjectId(sid), date: { $gte: sevenDaysAgo } } },
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            total:   { $sum: 1 },
          }},
          { $sort: { _id: 1 } },
        ]);
        const trend = raw.map(d => ({
          day: DAY_LABELS[new Date(d._id).getDay()],
          v:   d.total ? Math.round((d.present / d.total) * 100) : 0,
        }));
        return NextResponse.json({ trend });
      } catch (e) {
        return NextResponse.json({ trend: [] });
      }
    }

    if (trendClass) {
      const db = await connectToDatabase();
      if (!db) return NextResponse.json({ trend: [] });
      try {
        const sevenDaysAgo = new Date(Date.now() - 6 * 86400000);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        // Get all students in this section
        const sectionStudents = await User.find({ role: 'student', classOrSubject: trendClass }).lean();
        const sids = sectionStudents.map(u => u._id);
        if (!sids.length) return NextResponse.json({ trend: [] });
        const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const raw = await AttendanceRecord.aggregate([
          { $match: { studentId: { $in: sids }, date: { $gte: sevenDaysAgo } } },
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absent:  { $sum: { $cond: [{ $eq: ['$status', 'absent']  }, 1, 0] } },
            late:    { $sum: { $cond: [{ $eq: ['$status', 'late']    }, 1, 0] } },
            total:   { $sum: 1 },
          }},
          { $sort: { _id: 1 } },
        ]);
        const trend = raw.map(d => ({
          day:     DAY_LABELS[new Date(d._id).getDay()],
          present: d.present,
          absent:  d.absent,
          late:    d.late,
          pct:     d.total ? Math.round((d.present / d.total) * 100) : 0,
        }));
        return NextResponse.json({ trend });
      } catch (e) {
        return NextResponse.json({ trend: [] });
      }
    }

    const userRole = session?.user?.role;
    const userId   = session?.user?.id;

    if (userRole === 'faculty' || userRole === 'admin') {
      const records = await getAttendanceForFaculty(userId);
      return NextResponse.json({ records });
    }

    const records      = await getAttendanceByStudent(userId);
    const presentCount = records.filter(r => r.status === 'present').length;
    const total        = records.length;
    const percentage   = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    // Generate attendance warning if below threshold (non-blocking)
    try {
      if (percentage > 0 && percentage < 75) {
        const { onAttendanceWarning } = await import('@/lib/notificationEngine.js');
        await onAttendanceWarning(userId, '', percentage, 75);
      }
    } catch (notifErr) {
      // Non-fatal
    }

    return NextResponse.json({
      records,
      percentage,
      presentCount,
      absentCount: total - presentCount,
      totalClasses: total,
      hasAttendanceData: total > 0,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session  = await getServerSession(authOptions);
    const userRole = session?.user?.role;

    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Faculty or Admin role required' }, { status: 403 });
    }

    const body      = await request.json();
    const { records, studentId, status, confidenceScore } = body;
    const facultyId = session?.user?.id;

    // ── Single student submission ─────────────────────────────────────────
    if (!records && studentId) {
      const record = await createAttendanceRecord({
        studentId, facultyId,
        status: status || 'present',
        confidenceScore: confidenceScore || 95,
        date: new Date(),
      });
      return NextResponse.json({ success: true, record });
    }

    // ── Batch submission ──────────────────────────────────────────────────
    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'records array required' }, { status: 400 });
    }

    const saved = [];
    for (const r of records) {
      if (!r.studentId) continue;
      const rec = await createAttendanceRecord({
        studentId:        r.studentId,
        facultyId,
        status:           r.status           || 'present',
        confidenceScore:  r.confidenceScore  || 95,
        date:             new Date(),
        livenessVerified: r.livenessVerified ?? false,
        livenessChallenge: r.livenessChallenge ?? '',
      });
      saved.push(rec);
    }

    // ── Post-commit: success score recalculation + risk + alerts (non-blocking) ─
    const committedIds = records.map(r => r.studentId).filter(Boolean);
    batchRecalculate(committedIds).catch(err =>
      console.warn('[post-commit] score recalc error:', err.message)
    );
    runRiskAndAlerts(records, facultyId).catch(err =>
      console.warn('[post-commit] risk/alert error:', err.message)
    );

    return NextResponse.json({ success: true, count: saved.length, records: saved });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

/**
 * After committing attendance, compute risk tiers and fire WhatsApp alerts.
 * Runs async — does not block the HTTP response.
 */
async function runRiskAndAlerts(records, facultyId) {
  const db = await connectToDatabase();
  if (!db) return;

  const now     = new Date();
  const twoWeeksAgo = new Date(now - 14 * 86400000);
  const fourWeeksAgo = new Date(now - 28 * 86400000);

  const studentIds = records.map(r => r.studentId).filter(Boolean);

  // Fetch users (for guardianPhone + name)
  const users = await User.find({ _id: { $in: studentIds } }).lean();

  // Build per-student risk inputs
  const studentData = await Promise.all(users.map(async (u) => {
    const allAtt = await AttendanceRecord.find({ studentId: u._id }).sort({ date: -1 }).lean();

    const recent2w = allAtt.filter(a => new Date(a.date) >= twoWeeksAgo);
    const prev2w   = allAtt.filter(a => new Date(a.date) >= fourWeeksAgo && new Date(a.date) < twoWeeksAgo);

    const pct2w  = recent2w.length ? Math.round(recent2w.filter(a => a.status === 'present').length / recent2w.length * 100) : 90;
    const pctPrev = prev2w.length  ? Math.round(prev2w.filter(a => a.status === 'present').length  / prev2w.length  * 100) : 90;

    const quizAttempts = await QuizAttempt.find({ studentId: u._id }).sort({ createdAt: -1 }).limit(3).lean();
    const scores = quizAttempts.reverse().map(q => q.score);

    // Streak breaks: days in last 14 where no attendance record exists
    const presentDays = new Set(recent2w.filter(a => a.status === 'present').map(a => new Date(a.date).toDateString()));
    let streakBreaks = 0;
    for (let i = 0; i < 14; i++) {
      const d = new Date(now - i * 86400000).toDateString();
      if (!presentDays.has(d)) streakBreaks++;
    }

    // Last alert sent (for dedup)
    const lastRecord = allAtt[0];

    return {
      studentId:              String(u._id),
      name:                   u.name,
      guardianPhone:          u.guardianPhone || '',
      attendancePct:          pct2w,
      attendancePct2w:        pct2w,
      attendancePctPrev:      pctPrev,
      lastThreeQuizScores:    scores,
      streakBreaksLast14Days: streakBreaks,
      alertSentAt:            lastRecord?.alertSentAt || null,
    };
  }));

  const withRisk = batchPredictRisk(studentData);

  // Persist riskTier onto the most recent attendance record for each student
  for (const s of withRisk) {
    await AttendanceRecord.findOneAndUpdate(
      { studentId: s.studentId },
      { $set: {} }, // risk is computed on-the-fly; no schema field needed
      { sort: { date: -1 } }
    );
  }

  // Fire alerts
  await sendAttendanceAlerts(
    withRisk.map(s => ({
      studentId:    s.studentId,
      name:         s.name,
      guardianPhone: s.guardianPhone,
      attendancePct: s.attendancePct,
      riskTier:     s.riskTier,
      riskReasons:  s.riskReasons,
      alertSentAt:  s.alertSentAt,
    })),
    async (sid) => {
      await AttendanceRecord.findOneAndUpdate(
        { studentId: sid },
        { $set: { alertSentAt: new Date() } },
        { sort: { date: -1 } }
      );
    }
  );
}
