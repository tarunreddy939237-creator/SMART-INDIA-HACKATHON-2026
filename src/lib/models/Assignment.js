import mongoose from 'mongoose';

/**
 * Assignment — Tied to a Course. Auto-syncs to AcademicEvent calendar.
 */
const AssignmentSchema = new mongoose.Schema({
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['assignment', 'lab', 'project', 'quiz_prep', 'reading', 'practice'],
    default: 'assignment',
  },

  // Targeting (denormalized from course for fast queries)
  branch:   { type: String, required: true },
  year:     { type: Number, default: 0 },
  semester: { type: Number, default: 0 },
  section:  { type: String, default: '' },
  subject:  { type: String, default: '' },

  // Scheduling
  dueDate:  { type: Date, required: true },
  dueTime:  { type: String, default: '' },
  maxScore: { type: Number, default: 100 },

  // Attachment
  attachments: [{
    title: String,
    url:   String,
  }],

  // Linked calendar event (auto-created)
  calendarEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicEvent', default: null },

  // Status
  isActive: { type: Boolean, default: true },

}, { timestamps: true });

// Submission tracking
const SubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },

  // Submission content
  content:      { type: String, default: '' },  // text response
  fileUrl:      { type: String, default: '' },  // uploaded file
  fileName:     { type: String, default: '' },

  // Grading
  score:        { type: Number, default: null },
  maxScore:     { type: Number, default: 100 },
  feedback:     { type: String, default: '' },
  gradedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  gradedAt:     { type: Date, default: null },

  // Status
  status: {
    type: String,
    enum: ['submitted', 'graded', 'returned', 'late'],
    default: 'submitted',
  },

}, { timestamps: true });

SubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
SubmissionSchema.index({ studentId: 1, courseId: 1 });
SubmissionSchema.index({ assignmentId: 1, status: 1 });

export const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
export const Submission = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
