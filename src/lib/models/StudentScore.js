import mongoose from 'mongoose';

const StudentScoreSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // Success score (0-100) — weighted composite
  successScore: { type: Number, default: 0, min: 0, max: 100 },
  prevSuccessScore: { type: Number, default: null },

  // Breakdown of the 5 weighted signals (each 0-100 before weighting)
  breakdown: {
    attendance:  { type: Number, default: 0 },  // 25%
    academic:    { type: Number, default: 0 },  // 30%
    assignments: { type: Number, default: 0 },  // 20% (streak proxy until assignments exist)
    engagement:  { type: Number, default: 0 },  // 15% (quiz attempt frequency)
    consistency: { type: Number, default: 0 },  // 10% (streak length)
  },

  // Risk (derived from successScore breakdown)
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
  prevRiskScore: { type: Number, default: null },
  riskTier: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  riskFactors: [{ type: String }],
  structuredFactors: [{
    name: { type: String },
    weight: { type: Number },
    contribution: { type: Number },
    status: { type: String, enum: ['good', 'warn', 'bad'] },
    trend: { type: String, enum: ['improving', 'declining', 'stable', 'critical'] },
    detail: { type: String },
    hasData: { type: Boolean, default: true },
  }],

  // Trend direction
  trend: { type: String, enum: ['improving', 'declining', 'stable'], default: 'stable' },

  // History ring-buffer — last 10 snapshots for sparkline
  history: [{
    successScore: Number,
    riskScore:    Number,
    calculatedAt: Date,
  }],

  calculatedAt: { type: Date, default: Date.now },
});

StudentScoreSchema.index({ riskTier: 1 });

export default mongoose.models.StudentScore || mongoose.model('StudentScore', StudentScoreSchema);
