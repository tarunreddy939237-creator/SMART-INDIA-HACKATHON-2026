import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  actorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collegeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
  action:       { type: String, required: true, enum: [
    'account_approved', 'account_rejected', 'account_suspended', 'account_activated',
    'college_created', 'college_suspended', 'college_activated',
    'admin_assigned', 'admin_removed',
  ]},
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp:    { type: Date, default: Date.now },
});

AuditLogSchema.index({ collegeId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1 });
AuditLogSchema.index({ targetUserId: 1 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
