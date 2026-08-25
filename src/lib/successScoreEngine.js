/**
 * Student Success Score Engine
 * ─────────────────────────────
 * Deterministic weighted calculation — no LLM involved.
 *
 * Weights (total 100):
 *   Attendance   25%  — overall attendance % this semester
 *   Academic     30%  — average quiz score across all attempts
 *   Assignments  20%  — streak as proxy (until assignment model exists)
 *   Engagement   15%  — quiz attempt frequency (attempts per week)
 *   Consistency  10%  — current streak length normalised to 30 days
 *
 * Risk mapping (inverse of success):
 *   successScore >= 70  → Low risk
 *   successScore >= 45  → Medium risk
 *   successScore <  45  → High risk
 *
 * Risk score = 100 - successScore (clamped 0-100)
 */

import connectToDatabase from './mongodb.js';
import AttendanceRecord from './models/AttendanceRecord.js';
import QuizAttempt from './models/QuizAttempt.js';
import Streak from './models/Streak.js';
import StudentScore from './models/StudentScore.js';

// ── Signal calculators ────────────────────────────────────────────────────────

function calcAttendanceSignal(records) {
  if (!records.length) return 50; // neutral when no data
  const present = records.filter(r => r.status === 'present').length;
  return Math.round((present / records.length) * 100);
}

function calcAcademicSignal(attempts) {
  if (!attempts.length) return 50;
  const avg = attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length;
  return Math.round(avg);
}

function calcAssignmentSignal(streak) {
  // Proxy: streak > 0 means student is actively engaging daily
  // Normalise: 14+ days streak = 100, 0 days = 0
  const s = streak?.currentStreak ?? 0;
  return Math.min(100, Math.round((s / 14) * 100));
}

function calcEngagementSignal(attempts) {
  // Attempts per week over last 4 weeks — target is 2/week = 100
  if (!attempts.length) return 0;
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000);
  const recent = attempts.filter(a => new Date(a.createdAt) >= fourWeeksAgo);
  const perWeek = recent.length / 4;
  return Math.min(100, Math.round((perWeek / 2) * 100));
}

function calcConsistencySignal(streak) {
  // Normalise longestStreak to 30 days
  const s = streak?.longestStreak ?? 0;
  return Math.min(100, Math.round((s / 30) * 100));
}

// ── Composite score ───────────────────────────────────────────────────────────

function computeSuccessScore(breakdown) {
  return Math.round(
    breakdown.attendance  * 0.25 +
    breakdown.academic    * 0.30 +
    breakdown.assignments * 0.20 +
    breakdown.engagement  * 0.15 +
    breakdown.consistency * 0.10
  );
}

// ── Risk derivation ───────────────────────────────────────────────────────────

function deriveRisk(successScore, breakdown, attendanceRecords, quizAttempts) {
  const riskScore = Math.max(0, 100 - successScore);
  const riskTier  = successScore >= 70 ? 'Low' : successScore >= 45 ? 'Medium' : 'High';
  const factors   = [];
  const structuredFactors = [];

  // Attendance factor (25% weight)
  let attStatus = 'good';
  let attContrib = 0;
  if (breakdown.attendance < 75) {
    attStatus = 'bad'; attContrib = 25;
    factors.push(`Attendance is ${breakdown.attendance}% — below the 75% minimum threshold`);
  } else if (breakdown.attendance < 85) {
    attStatus = 'warn'; attContrib = 10;
    factors.push(`Attendance at ${breakdown.attendance}% — approaching risk threshold`);
  }
  structuredFactors.push({ name: 'Attendance', weight: 25, contribution: attContrib, status: attStatus, trend: breakdown.attendance >= 85 ? 'improving' : breakdown.attendance >= 75 ? 'stable' : 'declining', detail: `${breakdown.attendance}%`, hasData: true });

  // Academic factor (30% weight)
  let acadStatus = 'good';
  let acadContrib = 0;
  if (breakdown.academic < 50) {
    acadStatus = 'bad'; acadContrib = 30;
    factors.push(`Average quiz score is ${breakdown.academic}% — critically low`);
  } else if (breakdown.academic < 65) {
    acadStatus = 'warn'; acadContrib = 15;
    factors.push(`Quiz average of ${breakdown.academic}% is below the class median`);
  }
  // Detect declining quiz trend
  if (quizAttempts.length >= 2) {
    const sorted = [...quizAttempts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const last3  = sorted.slice(-3);
    const first  = last3[0].score;
    const last   = last3[last3.length - 1].score;
    if (last - first <= -15) {
      acadContrib += 10;
      factors.push(`Quiz scores declining: ${first}% → ${last}% over last ${last3.length} attempts`);
      if (acadStatus !== 'bad') acadStatus = 'warn';
    }
  }
  structuredFactors.push({ name: 'Academic Performance', weight: 30, contribution: Math.min(30, acadContrib), status: acadStatus, trend: breakdown.academic >= 75 ? 'improving' : breakdown.academic >= 50 ? 'stable' : 'declining', detail: `${breakdown.academic}%`, hasData: breakdown.academic > 0 });

  // Engagement factor (15% weight)
  let engStatus = 'good';
  let engContrib = 0;
  if (breakdown.engagement < 25) {
    engStatus = 'bad'; engContrib = 15;
    factors.push('Very low quiz engagement — fewer than 1 attempt per 2 weeks');
  } else if (breakdown.engagement < 50) {
    engStatus = 'warn'; engContrib = 5;
  }
  structuredFactors.push({ name: 'Engagement', weight: 15, contribution: engContrib, status: engStatus, trend: breakdown.engagement >= 50 ? 'improving' : breakdown.engagement >= 25 ? 'stable' : 'declining', detail: `${breakdown.engagement}/100`, hasData: true });

  // Consistency factor (10% weight)
  let consStatus = 'good';
  let consContrib = 0;
  if (breakdown.consistency < 20) {
    consStatus = 'bad'; consContrib = 10;
    factors.push('Low study consistency — streak history shows irregular engagement');
  } else if (breakdown.consistency < 50) {
    consStatus = 'warn'; consContrib = 3;
  }
  structuredFactors.push({ name: 'Study Consistency', weight: 10, contribution: consContrib, status: consStatus, trend: breakdown.consistency >= 50 ? 'improving' : breakdown.consistency >= 20 ? 'stable' : 'declining', detail: `${breakdown.consistency}/100`, hasData: true });

  // Assignments factor (20% weight)
  let assignStatus = 'good';
  let assignContrib = 0;
  if (breakdown.assignments < 30) {
    assignStatus = 'bad'; assignContrib = 20;
    factors.push('Very low assignment completion — streak proxy indicates disengagement');
  } else if (breakdown.assignments < 60) {
    assignStatus = 'warn'; assignContrib = 5;
  }
  structuredFactors.push({ name: 'Assignment Completion', weight: 20, contribution: assignContrib, status: assignStatus, trend: breakdown.assignments >= 60 ? 'improving' : breakdown.assignments >= 30 ? 'stable' : 'declining', detail: `${breakdown.assignments}/100`, hasData: true });

  if (factors.length === 0) {
    factors.push('All indicators within normal range');
  }

  return { riskScore, riskTier, riskFactors: factors, structuredFactors };
}

// ── Trend calculation ─────────────────────────────────────────────────────────

function calcTrend(current, previous) {
  if (previous === null || previous === undefined) return 'stable';
  const delta = current - previous;
  if (delta >= 3)  return 'improving';
  if (delta <= -3) return 'declining';
  return 'stable';
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Recalculate and persist the success + risk score for a student.
 * Safe to call fire-and-forget — all errors are caught internally.
 *
 * @param {string} studentId
 * @returns {Promise<object|null>} updated StudentScore document or null on failure
 */
export async function recalculate(studentId) {
  if (!studentId) return null;

  try {
    const db = await connectToDatabase();
    if (!db) return null;

    // Fetch all required data in parallel
    const [attendanceRecords, quizAttempts, streak] = await Promise.all([
      AttendanceRecord.find({ studentId }).lean(),
      QuizAttempt.find({ studentId }).sort({ createdAt: -1 }).lean(),
      Streak.findOne({ studentId }).lean(),
    ]);

    // Calculate each signal
    const breakdown = {
      attendance:  calcAttendanceSignal(attendanceRecords),
      academic:    calcAcademicSignal(quizAttempts),
      assignments: calcAssignmentSignal(streak),
      engagement:  calcEngagementSignal(quizAttempts),
      consistency: calcConsistencySignal(streak),
    };

    const successScore = computeSuccessScore(breakdown);
    const { riskScore, riskTier, riskFactors, structuredFactors } = deriveRisk(
      successScore, breakdown, attendanceRecords, quizAttempts
    );

    // Load existing record to preserve history and prev values
    let existing = await StudentScore.findOne({ studentId });

    const prevSuccessScore = existing?.successScore ?? null;
    const prevRiskScore    = existing?.riskScore    ?? null;
    const trend            = calcTrend(successScore, prevSuccessScore);

    // Build history snapshot (keep last 10)
    const historyEntry = { successScore, riskScore, calculatedAt: new Date() };
    const history = existing?.history ?? [];
    const updatedHistory = [...history, historyEntry].slice(-10);

    const update = {
      studentId,
      successScore,
      prevSuccessScore,
      breakdown,
      riskScore,
      prevRiskScore,
      riskTier,
      riskFactors,
      structuredFactors,
      trend,
      history: updatedHistory,
      calculatedAt: new Date(),
    };

    const result = await StudentScore.findOneAndUpdate(
      { studentId },
      { $set: update },
      { upsert: true, returnDocument: 'after' }
    );

    return result;
  } catch (err) {
    console.error('[successScoreEngine] recalculate error:', err.message);
    return null;
  }
}

/**
 * Batch recalculate for multiple students.
 * @param {string[]} studentIds
 */
export async function batchRecalculate(studentIds) {
  if (!studentIds?.length) return;
  await Promise.all(studentIds.map(id => recalculate(id)));
}

/**
 * Get the latest stored score for a student (no recalculation).
 * Falls back to a neutral object if no record exists yet.
 * @param {string} studentId
 */
export async function getScore(studentId) {
  if (!studentId) return null;
  try {
    const db = await connectToDatabase();
    if (!db) return null;
    return await StudentScore.findOne({ studentId }).lean();
  } catch (err) {
    console.error('[successScoreEngine] getScore error:', err.message);
    return null;
  }
}
