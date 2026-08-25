import mongoose from 'mongoose';

const MeetingSchema = new mongoose.Schema({
  // Unique public identifier for meeting URLs (not sequential DB _id)
  meetingUuid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  agenda: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  // Host (faculty/admin who created the meeting)
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  hostName: {
    type: String,
    required: true,
  },
  // Target class/section
  classOrSubject: {
    type: String,
    default: '',
  },
  branch: {
    type: String,
    default: '',
  },
  year: {
    type: String,
    default: '',
  },
  semester: {
    type: String,
    default: '',
  },
  section: {
    type: String,
    default: '',
  },
  // Schedule
  scheduledDate: {
    type: Date,
    required: true,
    index: true,
  },
  scheduledStartTime: {
    type: String, // "14:00" format
    required: true,
  },
  expectedDuration: {
    type: Number, // minutes
    required: true,
    default: 60,
  },
  // Actual timing
  actualStartTime: {
    type: Date,
    default: null,
  },
  actualEndTime: {
    type: Date,
    default: null,
  },
  // Status: scheduled, waiting, live, completed, cancelled
  status: {
    type: String,
    enum: ['scheduled', 'waiting', 'live', 'completed', 'cancelled'],
    default: 'scheduled',
    index: true,
  },
  // Settings
  visibility: {
    type: String,
    enum: ['class', 'specific'],
    default: 'class',
  },
  allowStudentScreenShare: {
    type: Boolean,
    default: false,
  },
  enableRecording: {
    type: Boolean,
    default: false,
  },
  // Targeted students (when visibility === 'specific')
  targetStudentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  // Stats (computed on meeting end)
  totalInvited: {
    type: Number,
    default: 0,
  },
  totalJoined: {
    type: Number,
    default: 0,
  },
  presentCount: {
    type: Number,
    default: 0,
  },
  partialCount: {
    type: Number,
    default: 0,
  },
  absentCount: {
    type: Number,
    default: 0,
  },
  averageAttendanceDuration: {
    type: Number, // minutes
    default: 0,
  },
  attendancePercentage: {
    type: Number, // 0-100
    default: 0,
  },
}, {
  timestamps: true,
});

// Compound indexes for common queries
MeetingSchema.index({ hostId: 1, status: 1 });
MeetingSchema.index({ scheduledDate: 1, status: 1 });
MeetingSchema.index({ branch: 1, year: 1, section: 1, scheduledDate: 1 });

export default mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchema);
