/**
 * Student 360° Report Service
 *
 * Aggregates all available student data into a comprehensive report.
 * Used by both parent portal and faculty portal.
 */

import connectToDatabase from './mongodb.js';
import User from './models/User.js';
import AttendanceRecord from './models/AttendanceRecord.js';
import QuizAttempt from './models/QuizAttempt.js';
import StudentScore from './models/StudentScore.js';
import Streak from './models/Streak.js';
import { Submission, Assignment } from './models/Assignment.js';
import { ClassTask } from './models/ClassTask.js';
import Feedback from './models/Feedback.js';
import { getQuizAttemptsByStudent } from './queries.js';

/**
 * Generate a complete student report.
 * @param {string} studentId - Student's MongoDB ObjectId
 * @param {object} options - { includePrivate: boolean, includeParentFeedback: boolean }
 * @returns {object|null} Complete report data
 */
export async function generateStudentReport(studentId, options = {}) {
  const { includePrivate = false, includeParentFeedback = false } = options;

  await connectToDatabase();

  const student = await User.findById(studentId)
    .select('-passwordHash -faceEmbedding -passwordResetToken -passwordResetExpires')
    .lean();

  if (!student) return null;

  // Fetch all data in parallel
  const [
    attendanceRecords,
    quizAttempts,
    studentScore,
    streak,
    submissions,
    assignments,
    classTasks,
    feedback,
  ] = await Promise.all([
    AttendanceRecord.find({ studentId }).sort({ date: -1 }).lean(),
    getQuizAttemptsByStudent(studentId),
    StudentScore.findOne({ studentId }).lean(),
    Streak.findOne({ studentId }).lean(),
    Submission.find({ studentId }).sort({ createdAt: -1 }).lean(),
    Assignment.find({ branch: student.branch || 'CSE', section: student.classOrSubject || 'CSE-A' }).lean(),
    ClassTask.find({ assignedTo: studentId }).sort({ createdAt: -1 }).lean(),
    Feedback.find({ studentId }).sort({ createdAt: -1 }).lean(),
  ]);

  // ── Attendance Analysis ────────────────────────────────────────────────
  const totalClasses = attendanceRecords.length || 1;
  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const absentCount = totalClasses - presentCount;
  const attendancePercentage = Math.round((presentCount / totalClasses) * 100);

  // Subject-wise attendance (from attendance records, approximate from faculty)
  const attendanceByDate = {};
  attendanceRecords.forEach(r => {
    const dateKey = new Date(r.date).toISOString().split('T')[0];
    if (!attendanceByDate[dateKey]) attendanceByDate[dateKey] = { present: 0, absent: 0 };
    if (r.status === 'present') attendanceByDate[dateKey].present++;
    else attendanceByDate[dateKey].absent++;
  });

  // ── Academic Performance ───────────────────────────────────────────────
  const quizScores = quizAttempts.map(qa => ({
    score: qa.score,
    weakTopics: qa.weakTopics || [],
    date: qa.createdAt,
    quizId: qa.quizId?._id || qa.quizId,
    subject: qa.quizId?.subject || 'General',
  }));

  const averageQuizScore = quizScores.length
    ? Math.round(quizScores.reduce((sum, q) => sum + q.score, 0) / quizScores.length)
    : 0;

  // ── Assignment Performance ─────────────────────────────────────────────
  const assignmentStats = {
    total: assignments.length,
    submitted: submissions.length,
    graded: submissions.filter(s => s.status === 'graded').length,
    averageScore: 0,
  };

  const gradedSubmissions = submissions.filter(s => s.score != null);
  if (gradedSubmissions.length) {
    assignmentStats.averageScore = Math.round(
      gradedSubmissions.reduce((sum, s) => sum + (s.score / s.maxScore) * 100, 0) / gradedSubmissions.length
    );
  }

  // ── Class Task Completion ──────────────────────────────────────────────
  const taskStats = {
    total: classTasks.length,
    completed: classTasks.filter(t => t.completed).length,
  };
  taskStats.percentage = taskStats.total
    ? Math.round((taskStats.completed / taskStats.total) * 100)
    : 0;

  // ── Risk Assessment ────────────────────────────────────────────────────
  const riskData = studentScore ? {
    score: studentScore.successScore,
    riskTier: studentScore.riskTier,
    riskScore: studentScore.riskScore,
    trend: studentScore.trend,
    factors: studentScore.structuredFactors || [],
    breakdown: studentScore.breakdown || {},
  } : null;

  // ── Weak Topics ────────────────────────────────────────────────────────
  const allWeakTopics = quizAttempts.flatMap(qa => qa.weakTopics || []);
  const weakTopicCounts = {};
  allWeakTopics.forEach(topic => {
    weakTopicCounts[topic] = (weakTopicCounts[topic] || 0) + 1;
  });
  const weakTopics = Object.entries(weakTopicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));

  // ── Streak Data ────────────────────────────────────────────────────────
  const streakData = streak ? {
    current: streak.currentStreak,
    longest: streak.longestStreak,
    badges: streak.badges || [],
  } : { current: 0, longest: 0, badges: [] };

  // ── AI Performance Summary ─────────────────────────────────────────────
  const summary = generatePerformanceSummary({
    attendancePercentage,
    averageQuizScore,
    assignmentStats,
    taskStats,
    riskData,
    weakTopics,
    streakData,
    totalQuizzes: quizScores.length,
  });

  return {
    student: {
      id: student._id,
      name: student.name,
      email: includePrivate ? student.email : undefined,
      rollNumber: student.rollNumber,
      yearOfStudy: student.yearOfStudy,
      branch: student.branch,
      section: student.section,
      classOrSubject: student.classOrSubject,
      collegeName: student.collegeName,
    },
    attendance: {
      totalClasses,
      presentCount,
      absentCount,
      percentage: attendancePercentage,
      recent: attendanceRecords.slice(0, 10).map(r => ({
        date: r.date,
        status: r.status,
        confidenceScore: r.confidenceScore,
      })),
    },
    academics: {
      averageQuizScore,
      totalQuizzes: quizScores.length,
      quizHistory: quizScores.slice(0, 10),
      weakTopics,
    },
    assignments: assignmentStats,
    classTasks: taskStats,
    risk: riskData,
    streak: streakData,
    feedback: includePrivate
      ? feedback.map(f => ({ rating: f.rating, comment: f.comment, subject: f.subjectOrFacultyId, date: f.createdAt }))
      : [],
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a text performance summary from the data.
 */
function generatePerformanceSummary(data) {
  const parts = [];

  if (data.attendancePercentage >= 90) {
    parts.push(`Excellent attendance at ${data.attendancePercentage}%.`);
  } else if (data.attendancePercentage >= 75) {
    parts.push(`Attendance is ${data.attendancePercentage}%, which is satisfactory.`);
  } else {
    parts.push(`⚠️ Attendance is ${data.attendancePercentage}%, below the recommended 75% threshold.`);
  }

  if (data.averageQuizScore >= 80) {
    parts.push(`Strong quiz performance with an average of ${data.averageQuizScore}%.`);
  } else if (data.averageQuizScore >= 60) {
    parts.push(`Quiz average is ${data.averageScore}%, with room for improvement.`);
  } else if (data.averageQuizScore > 0) {
    parts.push(`⚠️ Quiz average is ${data.averageQuizScore}%. Focus on weak areas.`);
  }

  if (data.assignmentStats.total > 0) {
    const subRate = Math.round((data.assignmentStats.submitted / data.assignmentStats.total) * 100);
    parts.push(`Assignment completion rate: ${subRate}%.`);
  }

  if (data.taskStats.total > 0) {
    parts.push(`Daily task completion: ${data.taskStats.percentage}%.`);
  }

  if (data.weakTopics.length > 0) {
    const topics = data.weakTopics.slice(0, 3).map(w => w.topic).join(', ');
    parts.push(`Areas needing attention: ${topics}.`);
  }

  if (data.riskData?.riskTier === 'High') {
    parts.push('🔴 Academic risk is HIGH — immediate attention recommended.');
  } else if (data.riskData?.riskTier === 'Medium') {
    parts.push('🟡 Academic risk is moderate — monitor closely.');
  }

  if (data.streakData.current >= 7) {
    parts.push(`🔥 ${data.streakData.current}-day learning streak — keep it up!`);
  }

  return parts.join(' ');
}
