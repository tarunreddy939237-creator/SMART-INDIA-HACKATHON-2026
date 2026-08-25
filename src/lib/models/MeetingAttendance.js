import mongoose from 'mongoose';

/**
 * Aggregated attendance record per participant per meeting.
 * Computed from MeetingAttendanceSession records when meeting ends.
 */
const MeetingAttendanceSchema = new mongoose.Schema({
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
  userRollNumber: {
    type: String,
    default: '',
  },
  firstJoinTime: {
    type: Date,
    default: null,
  },
  lastLeaveTime: {
    type: Date,
    default: null,
  },
  totalDuration: {
    type: Number, // seconds
    default: 0,
  },
  attendancePercentage: {
    type: Number, // 0-100
    default: 0,
  },
  // 'present' >= 75%, 'partial' >= 30%, 'absent' < 30%
  attendanceStatus: {
    type: String,
    enum: ['present', 'partial', 'absent', 'not_joined'],
    default: 'not_joined',
  },
  totalSessions: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

MeetingAttendanceSchema.index({ meetingId: 1, userId: 1 }, { unique: true });
MeetingAttendanceSchema.index({ userId: 1, attendancePercentage: -1 });

export default mongoose.models.MeetingAttendance || mongoose.model('MeetingAttendance', MeetingAttendanceSchema);
