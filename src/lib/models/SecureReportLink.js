import mongoose from 'mongoose';

const SecureReportLinkSchema = new mongoose.Schema({
  token:        { type: String, required: true, unique: true, index: true },
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collegeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },

  // Expiry
  expiresAt:    { type: Date, required: true },
  maxViews:     { type: Number, default: 10 },
  viewCount:    { type: Number, default: 0 },

  // Purpose
  purpose:      { type: String, enum: ['whatsapp', 'sms', 'email', 'direct'], default: 'direct' },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

SecureReportLinkSchema.index({ token: 1 });
SecureReportLinkSchema.index({ studentId: 1, createdAt: -1 });
SecureReportLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.SecureReportLink || mongoose.model('SecureReportLink', SecureReportLinkSchema);
