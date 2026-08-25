import mongoose from 'mongoose';

const CommunicationLogSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentUserId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  collegeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },

  channel:     { type: String, enum: ['whatsapp', 'sms', 'email'], required: true },
  sentBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Message content (the link/message sent)
  messagePreview: { type: String, default: '' },
  reportLinkToken:{ type: String, default: '' },

  // Delivery tracking
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending',
  },
  providerMessageId: { type: String, default: '' },
  failureReason:     { type: String, default: '' },
  sentAt:            { type: Date, default: null },
  deliveredAt:       { type: Date, default: null },
}, { timestamps: true });

CommunicationLogSchema.index({ studentId: 1, createdAt: -1 });
CommunicationLogSchema.index({ sentBy: 1, createdAt: -1 });
CommunicationLogSchema.index({ collegeId: 1, createdAt: -1 });

export default mongoose.models.CommunicationLog || mongoose.model('CommunicationLog', CommunicationLogSchema);
