import mongoose from 'mongoose';

/**
 * Notification — Smart Notification System
 * 
 * Notifications are generated from real academic events and stored persistently.
 * Each notification is deduplicated using a unique key.
 */
const NotificationSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:       { type: String, enum: ['student', 'faculty', 'admin'], default: 'student' },

  // Notification content
  type: {
    type: String,
    enum: [
      'ASSIGNMENT_NEW', 'ASSIGNMENT_DUE', 'ASSIGNMENT_OVERDUE',
      'QUIZ_NEW', 'QUIZ_REMINDER', 'QUIZ_RESULT',
      'EXAM_REMINDER', 'CLASS_REMINDER',
      'TASK_NEW', 'TASK_DUE', 'TASK_COMPLETED',
      'TEACHER_ANNOUNCEMENT',
      'WEAK_TOPIC', 'PERFORMANCE_DROP', 'PERFORMANCE_IMPROVEMENT',
      'ATTENDANCE_WARNING', 'STUDY_RECOMMENDATION',
      'ACHIEVEMENT', 'SYSTEM',
    ],
    required: true,
  },
  title:    { type: String, required: true },
  message:  { type: String, required: true },
  icon:     { type: String, default: '🔔' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },

  // State
  isRead:     { type: Boolean, default: false },
  isDismissed: { type: Boolean, default: false },

  // Navigation
  actionUrl:  { type: String, default: '' },

  // Source reference (for deduplication)
  sourceType:  { type: String, default: '' }, // 'AcademicEvent', 'ClassTask', 'Quiz', 'Attendance', etc.
  sourceId:    { type: mongoose.Schema.Types.ObjectId, default: null },
  notificationKey: { type: String, default: '', index: true }, // Unique dedup key

  // Target audience (inherited from source)
  targetAudience: {
    branch:   { type: String, default: '' },
    year:     { type: Number, default: 0 },
    semester: { type: Number, default: 0 },
    section:  { type: String, default: '' },
    subject:  { type: String, default: '' },
  },

  // Metadata
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days
}, { timestamps: true });

// Indexes for fast queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isDismissed: 1, createdAt: -1 });
NotificationSchema.index({ notificationKey: 1 }, { unique: true, sparse: true });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
