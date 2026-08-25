/**
 * Smart Notification Engine
 * ─────────────────────────
 * Centralized service for generating, deduplicating, and managing notifications.
 * 
 * All notifications are generated from real academic data.
 * Deduplication uses a unique key: userId + type + sourceId + triggerDate.
 */

import mongoose from 'mongoose';
import Notification from '@/lib/models/Notification.js';

/**
 * Generate a deduplication key for a notification.
 * Prevents duplicate notifications for the same event.
 */
function notificationKey(userId, type, sourceId, triggerDate) {
  const dateStr = triggerDate
    ? new Date(triggerDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `${userId}:${type}:${sourceId || 'none'}:${dateStr}`;
}

/**
 * Create a notification with deduplication.
 * Returns the notification if created, or null if it already exists.
 */
async function createNotification({
  userId,
  role = 'student',
  type,
  title,
  message,
  icon = '🔔',
  priority = 'normal',
  actionUrl = '',
  sourceType = '',
  sourceId = null,
  targetAudience = {},
  metadata = {},
  expiresAt = null,
  dedupDate = null, // Custom date for dedup key (e.g., assignment due date)
}) {
  try {
    const key = notificationKey(userId, type, sourceId, dedupDate);

    // Check if notification already exists
    const existing = await Notification.findOne({ notificationKey: key }).lean();
    if (existing) return null;

    const notification = await Notification.create({
      userId,
      role,
      type,
      title,
      message,
      icon,
      priority,
      actionUrl,
      sourceType,
      sourceId,
      notificationKey: key,
      targetAudience,
      metadata,
      expiresAt: expiresAt || undefined,
    });

    return notification;
  } catch (err) {
    // Duplicate key error is expected during concurrent requests
    if (err.code === 11000) return null;
    console.error('[notificationEngine] createNotification error:', err);
    return null;
  }
}

/**
 * Batch create notifications for multiple students.
 * Used when faculty creates an event targeting a section.
 */
async function createBulkNotifications({
  studentIds,
  role = 'student',
  type,
  title,
  message,
  icon = '🔔',
  priority = 'normal',
  actionUrl = '',
  sourceType = '',
  sourceId = null,
  targetAudience = {},
  metadata = {},
  dedupDate = null,
}) {
  const results = [];
  for (const studentId of studentIds) {
    const n = await createNotification({
      userId: studentId,
      role,
      type,
      title,
      message,
      icon,
      priority,
      actionUrl,
      sourceType,
      sourceId,
      targetAudience,
      metadata,
      dedupDate,
    });
    if (n) results.push(n);
  }
  return results;
}

// ──────────────────────────────────────────────────────
// NOTIFICATION GENERATORS (called from API routes)
// ──────────────────────────────────────────────────────

/**
 * Generate notifications when an academic event is created.
 */
export async function onAcademicEventCreated(event, matchingStudentIds) {
  const EVENT_ICONS = {
    exam: '📝', assignment: '📋', project: '🚀', internal_assessment: '📊',
    lab_exam: '🔬', class_test: '✏️', workshop: '🔧', seminar: '🎤',
    holiday: '🏖️', college_event: '🏛️', other: '📌',
  };
  const EVENT_LABELS = {
    exam: 'Exam', assignment: 'Assignment', project: 'Project',
    internal_assessment: 'Internal Assessment', lab_exam: 'Lab Exam',
    class_test: 'Class Test', workshop: 'Workshop', seminar: 'Seminar',
    holiday: 'Holiday', college_event: 'College Event', other: 'Event',
  };

  const icon = EVENT_ICONS[event.eventType] || '📌';
  const label = EVENT_LABELS[event.eventType] || 'Event';
  const dateStr = event.date ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  const title = `${icon} New ${label}`;
  const message = `${event.title}${event.subject ? ` in ${event.subject}` : ''}${dateStr ? ` — ${dateStr}` : ''}`;

  const priority = event.priority === 'critical' ? 'urgent' : event.priority === 'important' ? 'high' : 'normal';

  return createBulkNotifications({
    studentIds: matchingStudentIds,
    type: event.eventType === 'exam' ? 'EXAM_REMINDER' : 'ASSIGNMENT_NEW',
    title,
    message,
    icon,
    priority,
    actionUrl: '/student/calendar',
    sourceType: 'AcademicEvent',
    sourceId: event._id,
    targetAudience: event.targetAudience || {},
    metadata: { eventType: event.eventType, subject: event.subject, date: event.date },
    dedupDate: event.date,
  });
}

/**
 * Generate notifications when a class task is created.
 */
export async function onClassTaskCreated(task, matchingStudentIds) {
  const TYPE_ICONS = {
    study: '📚', assignment: '📋', lab_work: '🔬', practice: '✏️',
    revision: '📖', lecture: '🎥', quiz: '❓',
  };

  const icon = TYPE_ICONS[task.taskType] || '📋';
  const dateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  const title = `${icon} New Class Task`;
  const message = `${task.title}${task.subject ? ` — ${task.subject}` : ''}${dateStr ? ` (due ${dateStr})` : ''}`;

  const priority = task.priority === 'urgent' || task.priority === 'high' ? 'high' : 'normal';

  return createBulkNotifications({
    studentIds: matchingStudentIds,
    type: 'TASK_NEW',
    title,
    message,
    icon,
    priority,
    actionUrl: '/student/dashboard#daily-tasks',
    sourceType: 'ClassTask',
    sourceId: task._id,
    targetAudience: task.targetAudience || {},
    metadata: { taskType: task.taskType, subject: task.subject, dueDate: task.dueDate },
    dedupDate: task.dueDate || task.createdAt,
  });
}

/**
 * Generate notification when a quiz is created/available.
 */
export async function onQuizCreated(quiz, matchingStudentIds) {
  const title = '📝 New Quiz Available';
  const message = `${quiz.subject || 'Quiz'} — ${quiz.questions?.length || 0} questions`;
  const priority = 'normal';

  return createBulkNotifications({
    studentIds: matchingStudentIds,
    type: 'QUIZ_NEW',
    title,
    message,
    icon: '📝',
    priority,
    actionUrl: '/student/quizzes',
    sourceType: 'Quiz',
    sourceId: quiz._id,
    targetAudience: quiz.targetAudience || {},
    metadata: { subject: quiz.subject, questionCount: quiz.questions?.length },
  });
}

/**
 * Generate notification when a quiz result is available.
 */
export async function onQuizResult(studentId, quiz, score, weakTopics) {
  const title = '📊 Quiz Result';
  const message = `You scored ${score}% in ${quiz.subject || 'Quiz'}${weakTopics?.length ? `. Weak areas: ${weakTopics.slice(0, 2).join(', ')}` : ''}`;
  const priority = score < 50 ? 'high' : 'normal';
  const icon = score >= 70 ? '🟢' : score >= 50 ? '🟡' : '🔴';

  return createNotification({
    userId: studentId,
    type: 'QUIZ_RESULT',
    title,
    message,
    icon,
    priority,
    actionUrl: '/student/quizzes',
    sourceType: 'QuizAttempt',
    sourceId: quiz._id,
    metadata: { score, weakTopics, subject: quiz.subject },
  });
}

/**
 * Generate attendance warning notification.
 */
export async function onAttendanceWarning(studentId, subject, attendancePct, threshold = 75) {
  if (attendancePct >= threshold) return null;

  const title = '⚠️ Attendance Warning';
  const message = `Your${subject ? ` ${subject}` : ''} attendance is ${attendancePct}% — below the ${threshold}% threshold.`;

  return createNotification({
    userId: studentId,
    type: 'ATTENDANCE_WARNING',
    title,
    message,
    icon: '⚠️',
    priority: attendancePct < 65 ? 'urgent' : 'high',
    actionUrl: '/student/dashboard',
    sourceType: 'Attendance',
    sourceId: studentId,
    metadata: { attendancePct, threshold, subject },
  });
}

/**
 * Generate weak topic notification.
 */
export async function onWeakTopicDetected(studentId, topic, accuracy) {
  const title = '🧠 Weak Topic Detected';
  const message = `Your performance in ${topic} is at ${accuracy}%. Consider revising it today.`;

  return createNotification({
    userId: studentId,
    type: 'WEAK_TOPIC',
    title,
    message,
    icon: '🧠',
    priority: accuracy < 40 ? 'high' : 'normal',
    actionUrl: '/student/learning',
    sourceType: 'StudyPlan',
    sourceId: studentId,
    metadata: { topic, accuracy },
  });
}

/**
 * Generate study recommendation notification.
 */
export async function onStudyRecommendation(studentId, topic, duration) {
  const title = '🤖 AI Study Recommendation';
  const message = `Spend ${duration} minutes revising ${topic} today.`;

  return createNotification({
    userId: studentId,
    type: 'STUDY_RECOMMENDATION',
    title,
    message,
    icon: '🤖',
    priority: 'normal',
    actionUrl: '/student/learning',
    sourceType: 'AIRecommendation',
    sourceId: studentId,
    metadata: { topic, duration },
  });
}

/**
 * Generate faculty notification (for at-risk students).
 */
export async function onFacultyAlert(facultyId, message, metadata = {}) {
  return createNotification({
    userId: facultyId,
    role: 'faculty',
    type: 'SYSTEM',
    title: '🚨 Academic Alert',
    message,
    icon: '🚨',
    priority: 'high',
    actionUrl: '/faculty/students',
    sourceType: 'RiskEngine',
    sourceId: facultyId,
    metadata,
  });
}

export default {
  createNotification,
  createBulkNotifications,
  onAcademicEventCreated,
  onClassTaskCreated,
  onQuizCreated,
  onQuizResult,
  onAttendanceWarning,
  onWeakTopicDetected,
  onStudyRecommendation,
  onFacultyAlert,
};
