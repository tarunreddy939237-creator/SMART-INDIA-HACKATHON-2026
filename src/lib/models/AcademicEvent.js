import mongoose from 'mongoose';

const AcademicEventSchema = new mongoose.Schema({
  // Who created it
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Event details
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  eventType: {
    type: String,
    enum: ['exam', 'assignment', 'project', 'internal_assessment', 'lab_exam',
           'class_test', 'workshop', 'seminar', 'holiday', 'college_event', 'other'],
    required: true,
  },
  priority: {
    type: String,
    enum: ['normal', 'important', 'critical'],
    default: 'normal',
  },

  // Scheduling
  date:      { type: Date, required: true },
  startTime: { type: String, default: '' },  // "09:00"
  endTime:   { type: String, default: '' },  // "11:00"

  // Academic targeting (legacy fields kept for backward compat)
  subject:  { type: String, default: '' },
  section:  { type: String, default: '' },  // e.g. "CSE-A"
  venue:    { type: String, default: '' },

  // Structured target audience
  targetAudience: {
    branch:     { type: String, default: '' },   // "CSE", "ECE", etc.
    year:       { type: Number, default: 0 },     // 1-4, 0 = all
    semester:   { type: Number, default: 0 },     // 1-2, 0 = all
    section:    { type: String, default: '' },     // "A", "B", etc.
    subject:    { type: String, default: '' },     // subject name
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },

  // Legacy target sections (kept for backward compat)
  targetSections: [{ type: String }],

  // Attachments
  attachments: [{
    title: String,
    url:   String,
  }],

  // Status
  isActive: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

AcademicEventSchema.index({ date: 1, isActive: 1 });
AcademicEventSchema.index({ section: 1, date: 1 });
AcademicEventSchema.index({ createdBy: 1, date: -1 });

export default mongoose.models.AcademicEvent || mongoose.model('AcademicEvent', AcademicEventSchema);
