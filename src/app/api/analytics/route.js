import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import AttendanceRecord from '@/lib/models/AttendanceRecord.js';
import QuizAttempt from '@/lib/models/QuizAttempt.js';
import StudentScore from '@/lib/models/StudentScore.js';
import { ClassTask, TaskCompletion } from '@/lib/models/ClassTask.js';
import AcademicEvent from '@/lib/models/AcademicEvent.js';
import { parseClassOrSubject } from '@/lib/targeting.js';

/**
 * GET /api/analytics?type=class_pulse|risk_radar|topic_weakness|deadline_collision&section=CSE-A
 *
 * Faculty-only analytics endpoints.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'faculty' && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Faculty role required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'class_pulse';
    const section = searchParams.get('section') || '';

    await connectToDatabase();

    switch (type) {
      case 'class_pulse':
        return await getClassPulse(session.user.id, section);
      case 'risk_radar':
        return await getRiskRadar(session.user.id, section);
      case 'topic_weakness':
        return await getTopicWeakness(session.user.id, section);
      case 'deadline_collision':
        return await getDeadlineCollisions(session.user.id);
      case 'early_intervention':
        return await getEarlyIntervention(session.user.id, section);
      default:
        return NextResponse.json({ error: 'Unknown analytics type' }, { status: 400 });
    }
  } catch (error) {
    console.error('[analytics] GET error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// ── Class Pulse ───────────────────────────────────────────────────────────
async function getClassPulse(facultyId, section) {
  const students = await User.find({
    role: 'student',
    ...(section ? { classOrSubject: new RegExp(`^${section}`, 'i') } : {}),
  }).select('name classOrSubject').lean();

  const studentIds = students.map(s => s._id);

  // Task completion rate
  const totalTasks = await ClassTask.countDocuments({
    createdBy: facultyId,
    isActive: true,
    ...(section ? { section: new RegExp(`^${section}`, 'i') } : {}),
  });

  const completedTasks = await TaskCompletion.countDocuments({
    taskId: { $in: (await ClassTask.find({ createdBy: facultyId, isActive: true }).select('_id').lean()).map(t => t._id) },
    completed: true,
  });

  // Quiz average
  const quizAttempts = await QuizAttempt.find({
    studentId: { $in: studentIds },
  }).lean();

  const avgQuizScore = quizAttempts.length > 0
    ? Math.round(quizAttempts.reduce((s, a) => s + (a.score || 0), 0) / quizAttempts.length)
    : 0;

  // At-risk students
  const atRiskStudents = await StudentScore.find({
    studentId: { $in: studentIds },
    riskTier: 'High',
  }).populate('studentId', 'name classOrSubject').lean();

  // Upcoming events
  const upcomingEvents = await AcademicEvent.find({
    createdBy: facultyId,
    isActive: true,
    date: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400000) },
  }).sort({ date: 1 }).lean();

  return NextResponse.json({
    totalStudents: students.length,
    taskCompletion: totalTasks > 0 ? Math.round((completedTasks / (totalTasks * Math.max(students.length, 1))) * 100) : 0,
    avgQuizScore,
    atRiskCount: atRiskStudents.length,
    atRiskStudents: atRiskStudents.map(s => ({
      id: s.studentId?._id,
      name: s.studentId?.name,
      section: s.studentId?.classOrSubject,
      riskScore: s.riskScore,
      riskTier: s.riskTier,
    })),
    upcomingEvents: upcomingEvents.map(e => ({
      id: e._id,
      title: e.title,
      date: e.date,
      eventType: e.eventType,
      subject: e.subject,
    })),
    pendingAssessments: upcomingEvents.filter(e => ['exam', 'assignment', 'class_test'].includes(e.eventType)).length,
    engagement: quizAttempts.length > 0 ? Math.min(100, Math.round((quizAttempts.filter(a => {
      const d = new Date(a.createdAt);
      const week = Date.now() - 7 * 86400000;
      return d >= week;
    }).length / Math.max(studentIds.length, 1)) * 100)) : 0,
  });
}

// ── Risk Radar ────────────────────────────────────────────────────────────
async function getRiskRadar(facultyId, section) {
  const students = await User.find({
    role: 'student',
    ...(section ? { classOrSubject: new RegExp(`^${section}`, 'i') } : {}),
  }).select('name classOrSubject').lean();

  const studentIds = students.map(s => s._id);
  const scores = await StudentScore.find({ studentId: { $in: studentIds } })
    .populate('studentId', 'name classOrSubject')
    .lean();

  const onTrack = scores.filter(s => s.riskTier === 'Low').length;
  const needsAttention = scores.filter(s => s.riskTier === 'Medium').length;
  const atRisk = scores.filter(s => s.riskTier === 'High').length;

  return NextResponse.json({
    total: students.length,
    onTrack,
    needsAttention,
    atRisk,
    students: scores.map(s => ({
      id: s.studentId?._id,
      name: s.studentId?.name,
      section: s.studentId?.classOrSubject,
      riskScore: s.riskScore,
      riskTier: s.riskTier,
      trend: s.trend,
      factors: s.riskFactors,
    })),
  });
}

// ── Topic Weakness ────────────────────────────────────────────────────────
async function getTopicWeakness(facultyId, section) {
  const students = await User.find({
    role: 'student',
    ...(section ? { classOrSubject: new RegExp(`^${section}`, 'i') } : {}),
  }).select('_id').lean();

  const studentIds = students.map(s => s._id);
  const attempts = await QuizAttempt.find({ studentId: { $in: studentIds } }).lean();

  // Aggregate weak topics
  const topicStats = {};
  attempts.forEach(a => {
    (a.weakTopics || []).forEach(topic => {
      if (!topicStats[topic]) topicStats[topic] = { misses: 0, total: 0 };
      topicStats[topic].misses++;
    });
    // Count all topics from the quiz (approximate)
  });

  const weaknesses = Object.entries(topicStats)
    .map(([topic, stats]) => ({
      topic,
      misses: stats.misses,
      studentsAffected: Math.min(stats.misses, students.length),
    }))
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 10);

  return NextResponse.json({ weaknesses });
}

// ── Deadline Collision Detection ───────────────────────────────────────────
async function getDeadlineCollisions(facultyId) {
  const now = new Date();
  const next48h = new Date(now.getTime() + 48 * 3600000);
  const next7d = new Date(now.getTime() + 7 * 86400000);

  // Events in the next 48 hours
  const urgentEvents = await AcademicEvent.find({
    isActive: true,
    date: { $gte: now, $lte: next48h },
    eventType: { $in: ['exam', 'assignment', 'project', 'internal_assessment', 'class_test'] },
  }).sort({ date: 1 }).lean();

  // Events in the next 7 days
  const weekEvents = await AcademicEvent.find({
    isActive: true,
    date: { $gte: now, $lte: next7d },
    eventType: { $in: ['exam', 'assignment', 'project', 'internal_assessment', 'class_test'] },
  }).sort({ date: 1 }).lean();

  // Detect collisions: multiple events on the same day
  const dayGroups = {};
  weekEvents.forEach(e => {
    const dayKey = new Date(e.date).toDateString();
    if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
    dayGroups[dayKey].push(e);
  });

  const collisions = Object.entries(dayGroups)
    .filter(([, events]) => events.length >= 2)
    .map(([day, events]) => ({
      date: day,
      count: events.length,
      events: events.map(e => ({
        id: e._id,
        title: e.title,
        eventType: e.eventType,
        subject: e.subject,
        section: e.section,
      })),
    }));

  return NextResponse.json({
    urgentCount: urgentEvents.length,
    weekCount: weekEvents.length,
    collisions,
    hasCollision: collisions.length > 0,
    message: collisions.length > 0
      ? `⚠️ ${collisions.length} day(s) have multiple assessments within the next 7 days.`
      : 'No deadline conflicts detected.',
  });
}

// ── Early Intervention ────────────────────────────────────────────────────
async function getEarlyIntervention(facultyId, section) {
  const students = await User.find({
    role: 'student',
    ...(section ? { classOrSubject: new RegExp(`^${section}`, 'i') } : {}),
  }).select('name classOrSubject').lean();

  const studentIds = students.map(s => s._id);
  const scores = await StudentScore.find({ studentId: { $in: studentIds } })
    .populate('studentId', 'name classOrSubject')
    .lean();

  const needAttention = scores.filter(s => s.riskTier === 'Medium' || s.riskTier === 'High');

  // Get detailed info for each at-risk student
  const details = await Promise.all(needAttention.map(async (s) => {
    const studentId = s.studentId?._id;
    if (!studentId) return null;

    const [attempts, completions] = await Promise.all([
      QuizAttempt.find({ studentId }).sort({ createdAt: -1 }).limit(5).lean(),
      TaskCompletion.find({ studentId, completed: true }).countDocuments(),
    ]);

    return {
      id: studentId,
      name: s.studentId?.name,
      section: s.studentId?.classOrSubject,
      riskTier: s.riskTier,
      riskScore: s.riskScore,
      riskFactors: s.riskFactors || [],
      recentQuizScores: attempts.map(a => a.score),
      avgQuizScore: attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) : 0,
      tasksCompleted: completions,
    };
  }));

  return NextResponse.json({
    count: needAttention.length,
    students: details.filter(Boolean),
  });
}
