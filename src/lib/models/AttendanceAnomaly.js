import mongoose from 'mongoose';

const AttendanceAnomalySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expectedSection: { type: String, required: true },  // student's enrolled section
  actualSession: { type: String, required: true },     // section where attendance was marked
  confidence: { type: Number, min: 0, max: 100 },     // face match confidence
  timestamp: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },         // faculty override
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  notes: { type: String, default: '' },
});

AttendanceAnomalySchema.index({ studentId: 1, timestamp: -1 });
AttendanceAnomalySchema.index({ resolved: 1 });

export default mongoose.models.AttendanceAnomaly ||
  mongoose.model('AttendanceAnomaly', AttendanceAnomalySchema);
