import mongoose from 'mongoose';

/**
 * Individual join/leave session for a participant in a meeting.
 * Supports multiple sessions (e.g. network disconnect + reconnect).
 * Total attendance is computed by summing all session durations.
 */
const MeetingAttendanceSessionSchema = new mongoose.Schema({
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
  joinTime: {
    type: Date,
    required: true,
  },
  leaveTime: {
    type: Date,
    default: null, // null while still connected
  },
  duration: {
    type: Number, // seconds, computed on leave
    default: 0,
  },
  connectionId: {
    type: String, // unique socket/connection identifier to prevent duplicates
    default: '',
  },
}, {
  timestamps: true,
});

MeetingAttendanceSessionSchema.index({ meetingId: 1, userId: 1 });
MeetingAttendanceSessionSchema.index({ userId: 1 });

export default mongoose.models.MeetingAttendanceSession || mongoose.model('MeetingAttendanceSession', MeetingAttendanceSessionSchema);
