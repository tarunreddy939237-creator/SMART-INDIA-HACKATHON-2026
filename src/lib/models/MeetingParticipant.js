import mongoose from 'mongoose';

const MeetingParticipantSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userRole: {
    type: String,
    enum: ['faculty', 'student', 'admin'],
    default: 'student',
  },
  invitedAt: {
    type: Date,
    default: Date.now,
  },
  invitationStatus: {
    type: String,
    enum: ['invited', 'accepted', 'declined', 'pending'],
    default: 'invited',
  },
}, {
  timestamps: true,
});

// One participant per meeting
MeetingParticipantSchema.index({ meetingId: 1, userId: 1 }, { unique: true });
MeetingParticipantSchema.index({ userId: 1, invitedAt: -1 });

export default mongoose.models.MeetingParticipant || mongoose.model('MeetingParticipant', MeetingParticipantSchema);
