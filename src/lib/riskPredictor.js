/**
 * At-Risk Student Predictor
 * ─────────────────────────
 * Pure JS weighted scoring formula — no external ML runtime.
 * Inputs:  rolling attendance % (last 2 weeks), quiz score delta (last 3), streak breaks
 * Output:  { tier, score, reasons, structuredFactors[] }
 *
 * Scoring weights (total 100 pts):
 *   Attendance drop (2-week)  → up to 50 pts
 *   Quiz score trend          → up to 30 pts
 *   Streak breaks             → up to 20 pts
 *
 * Thresholds:
 *   score >= 60  → High risk
 *   score >= 30  → Medium risk
 *   score <  30  → Low risk
 */

/**
 * @param {object} params
 * @param {number} params.attendancePct2w   - attendance % over last 2 weeks (0-100)
 * @param {number} params.attendancePctPrev - attendance % in the 2 weeks before that (0-100)
 * @param {number[]} params.lastThreeQuizScores - array of up to 3 recent quiz scores (0-100), oldest first
 * @param {number} params.streakBreaksLast14Days - number of streak breaks in last 14 days
 * @returns {{ tier: string, score: number, reasons: string[] }}
 */
export function predictRisk({ attendancePct2w, attendancePctPrev, lastThreeQuizScores, streakBreaksLast14Days }) {
  const reasons = [];
  const factors = [];
  let riskScore = 0;

  // ── 1. Attendance drop (weight: 50%) ─────────────────────────────────────
  const attDrop = attendancePctPrev - attendancePct2w;   // positive = dropped
  let attContribution = 0;
  let attTrend = 'stable';
  if (attendancePct2w < 75) {
    attContribution = 50;
    reasons.push(`Attendance is ${attendancePct2w}% — below the 75% minimum threshold`);
    attTrend = 'critical';
  } else if (attDrop >= 15) {
    attContribution = 40;
    reasons.push(`Attendance dropped from ${attendancePctPrev}% to ${attendancePct2w}% in 2 weeks (−${attDrop}%)`);
    attTrend = 'declining';
  } else if (attDrop >= 8) {
    attContribution = 25;
    reasons.push(`Attendance declined from ${attendancePctPrev}% to ${attendancePct2w}% (−${attDrop}%)`);
    attTrend = 'declining';
  } else if (attDrop >= 3) {
    attContribution = 10;
    reasons.push(`Minor attendance dip: ${attendancePctPrev}% → ${attendancePct2w}%`);
    attTrend = 'declining';
  } else if (attDrop <= -3) {
    attTrend = 'improving';
  }
  riskScore += attContribution;
  const attStatus = attContribution >= 25 ? 'bad' : attContribution >= 10 ? 'warn' : 'good';
  factors.push({
    name: 'Attendance',
    weight: 50,
    contribution: attContribution,
    status: attStatus,
    trend: attTrend,
    detail: attDrop > 0 ? `${attendancePctPrev}% → ${attendancePct2w}%` : `${attendancePct2w}%`,
    hasData: attendancePct2w > 0 || attendancePctPrev > 0,
  });

  // ── 2. Quiz score trend (weight: 30%) ────────────────────────────────────
  const scores = (lastThreeQuizScores || []).filter(s => typeof s === 'number');
  let quizContribution = 0;
  let quizTrend = 'stable';
  if (scores.length >= 2) {
    const first = scores[0];
    const last  = scores[scores.length - 1];
    const delta = last - first;   // negative = declining
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avgScore < 50) {
      quizContribution = 30;
      reasons.push(`Average quiz score is ${Math.round(avgScore)}% — critically low`);
      quizTrend = 'critical';
    } else if (delta <= -20) {
      quizContribution = 25;
      reasons.push(`Quiz scores declining: ${first}% → ${last}% (−${Math.abs(delta)}% over last 3 quizzes)`);
      quizTrend = 'declining';
    } else if (delta <= -10) {
      quizContribution = 15;
      reasons.push(`Quiz performance trending down: ${first}% → ${last}%`);
      quizTrend = 'declining';
    } else if (avgScore < 65) {
      quizContribution = 10;
      reasons.push(`Quiz average of ${Math.round(avgScore)}% is below the class median`);
      quizTrend = 'declining';
    } else if (delta >= 10) {
      quizTrend = 'improving';
    }
  } else if (scores.length === 0) {
    quizContribution = 15;
    reasons.push('No quiz attempts recorded in the current period');
  }
  riskScore += quizContribution;
  const quizStatus = quizContribution >= 15 ? 'bad' : quizContribution >= 5 ? 'warn' : 'good';
  factors.push({
    name: 'Academic Performance',
    weight: 30,
    contribution: quizContribution,
    status: quizStatus,
    trend: quizTrend,
    detail: scores.length >= 2 ? `${scores[0]}% → ${scores[scores.length - 1]}%` : scores.length === 1 ? `${scores[0]}%` : 'No data',
    hasData: scores.length > 0,
  });

  // ── 3. Streak breaks (weight: 20%) ───────────────────────────────────────
  const breaks = streakBreaksLast14Days || 0;
  let streakContribution = 0;
  let streakTrend = 'stable';
  if (breaks >= 5) {
    streakContribution = 20;
    reasons.push(`${breaks} streak breaks in the last 14 days — consistent disengagement`);
    streakTrend = 'critical';
  } else if (breaks >= 3) {
    streakContribution = 12;
    reasons.push(`${breaks} streak breaks in the last 14 days`);
    streakTrend = 'declining';
  } else if (breaks >= 1) {
    streakContribution = 5;
    reasons.push(`${breaks} streak break(s) in the last 14 days`);
    streakTrend = 'declining';
  } else if (breaks === 0) {
    streakTrend = 'improving';
  }
  riskScore += streakContribution;
  const streakStatus = streakContribution >= 12 ? 'bad' : streakContribution >= 5 ? 'warn' : 'good';
  factors.push({
    name: 'Study Consistency',
    weight: 20,
    contribution: streakContribution,
    status: streakStatus,
    trend: streakTrend,
    detail: `${breaks} breaks in 14 days`,
    hasData: true,
  });

  // ── Tier classification ───────────────────────────────────────────────────
  const clampedScore = Math.min(100, riskScore);
  const tier = clampedScore >= 60 ? 'High' : clampedScore >= 30 ? 'Medium' : 'Low';

  if (reasons.length === 0) {
    reasons.push('All indicators within normal range');
  }

  return { tier, score: clampedScore, reasons, factors };
}

/**
 * Batch-predict risk for a list of students.
 * Each student object must have the fields expected by predictRisk().
 * Returns the same array with { riskTier, riskScore, riskReasons } appended.
 */
export function batchPredictRisk(students) {
  return students.map(s => {
    const result = predictRisk({
      attendancePct2w:        s.attendancePct2w        ?? 90,
      attendancePctPrev:      s.attendancePctPrev       ?? 90,
      lastThreeQuizScores:    s.lastThreeQuizScores     ?? [],
      streakBreaksLast14Days: s.streakBreaksLast14Days  ?? 0,
    });
    return { ...s, riskTier: result.tier, riskScore: result.score, riskReasons: result.reasons };
  });
}
