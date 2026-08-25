import mongoose from 'mongoose';

const ParentFeedbackSchema = new mongoose.Schema({
  parentUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collegeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },

  category: {
    type: String,
    enum: ['academic', 'attendance', 'behaviour', 'infrastructure', 'general'],
    required: true,
  },
  subject:       { type: String, required: true, trim: true, maxlength: 200 },
  message:       { type: String, required: true, trim: true, maxlength: 2000 },
  priority:      { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

  // Status tracking
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'responded', 'resolved'],
    default: 'submitted',
  },
  facultyResponse: { type: String, default: '' },
  respondedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  respondedAt:     { type: Date, default: null },
}, { timestamps: true });

ParentFeedbackSchema.index({ parentUserId: 1, createdAt: -1 });
ParentFeedbackSchema.index({ studentId: 1, status: 1 });
ParentFeedbackSchema.index({ collegeId: 1, status: 1 });

export default mongoose.models.ParentFeedback || mongoose.model('ParentFeedback', ParentFeedbackSchema);
