import mongoose from 'mongoose';

const ClassTaskSchema = new mongoose.Schema({
  // Faculty who created the task
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Target audience (legacy field)
  section:  { type: String, required: true },  // e.g. "CSE-A"
  subject:  { type: String, required: true },  // e.g. "Digital Electronics"

  // Structured target audience
  targetAudience: {
    branch:     { type: String, default: '' },
    year:       { type: Number, default: 0 },
    semester:   { type: Number, default: 0 },
    section:    { type: String, default: '' },
    subject:    { type: String, default: '' },
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },

  // Task details
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  taskType: {
    type: String,
    enum: ['study', 'assignment', 'lab_work', 'practice', 'revision', 'lecture', 'quiz'],
    default: 'study',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },

  // Due date/time
  dueDate:  { type: Date, required: true },
  dueTime:  { type: String, default: '' },  // e.g. "8:00 PM" — display only

  // Optional attachment/resource
  resourceUrl: { type: String, default: '' },
  resourceTitle: { type: String, default: '' },

  // Status
  isActive: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
});

// Student completion tracking
const TaskCompletionSchema = new mongoose.Schema({
  taskId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ClassTask', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

// Compound index: one completion per student per task
TaskCompletionSchema.index({ taskId: 1, studentId: 1 }, { unique: true });

export const ClassTask = mongoose.models.ClassTask || mongoose.model('ClassTask', ClassTaskSchema);
export const TaskCompletion = mongoose.models.TaskCompletion || mongoose.model('TaskCompletion', TaskCompletionSchema);
