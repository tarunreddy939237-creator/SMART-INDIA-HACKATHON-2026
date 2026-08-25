import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['student', 'faculty', 'admin', 'college_admin', 'super_admin'], required: true, default: 'student' },
  classOrSubject: { type: String, default: 'CSE-A' },
  rollNumber:    { type: String, default: '', trim: true },
  yearOfStudy:   { type: Number, default: 0, min: 0, max: 4 },
  facultyId:     { type: String, default: '', trim: true },  // Employee/Faculty ID for faculty users
  subjects: { type: [String], default: [] },
  labs:     { type: [String], default: [] },
  faceEmbedding: { type: [Number], default: [] },
  passwordHash: { type: String, required: true },
  guardianPhone: { type: String, default: '' },
  guardianContact: {
    name:  { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    preferredChannel: { type: String, enum: ['whatsapp', 'sms', 'email'], default: 'whatsapp' },
  },
  notifyOptIn: { type: Boolean, default: true },
  languagePreference: { type: String, enum: ['en', 'te', 'hi'], default: 'en' },
  accessibilitySettings: {
    fontSize:      { type: String, enum: ['normal', 'large', 'xlarge'], default: 'normal' },
    highContrast:  { type: Boolean, default: false },
    reducedMotion: { type: Boolean, default: false },
  },
  // Password reset
  passwordResetToken:   { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },
  passwordResetUsed:    { type: Boolean, default: false },

  // ── College / Multi-tenant fields ──────────────────────────────────────
  collegeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
  collegeName:   { type: String, default: '', trim: true },  // Denormalized for display
  accountStatus: { type: String, enum: ['pending', 'active', 'rejected', 'suspended', 'deactivated'], default: 'pending' },
  emailVerified: { type: Boolean, default: false },
  approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:    { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  // Department / Branch / Section for faculty-student scoping
  department:    { type: String, default: '' },
  branch:        { type: String, default: '' },  // e.g. "CSE", "ECE"
  section:       { type: String, default: '' },  // e.g. "A", "B"

  // ── Mobile verification fields ────────────────────────────────────────
  studentMobile:          { type: String, default: '', trim: true },
  studentMobileVerified:  { type: Boolean, default: false },
  parentMobile:           { type: String, default: '', trim: true },
  parentMobileVerified:   { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserSchema.index({ role: 1 });
UserSchema.index({ classOrSubject: 1 });
UserSchema.index({ rollNumber: 1, classOrSubject: 1 }, { sparse: true });
UserSchema.index({ collegeId: 1 });
UserSchema.index({ collegeId: 1, accountStatus: 1 });
UserSchema.index({ collegeId: 1, role: 1 });
UserSchema.index({ collegeId: 1, rollNumber: 1 }, { sparse: true });
UserSchema.index({ collegeId: 1, facultyId: 1 }, { sparse: true });
UserSchema.index({ studentMobile: 1 }, { sparse: true, unique: true });
UserSchema.index({ parentMobile: 1 }, { sparse: true, unique: true });

// Auto-update updatedAt (Mongoose 7+ uses async, no next callback)
UserSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
