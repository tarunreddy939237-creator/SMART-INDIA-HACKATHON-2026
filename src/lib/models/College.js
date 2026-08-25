import mongoose from 'mongoose';

const CollegeSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, lowercase: true, trim: true, unique: true },
  shortName:      { type: String, default: '', trim: true },
  status:         { type: String, enum: ['active', 'suspended', 'inactive'], default: 'active' },
  adminId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  domain:         { type: String, default: '', trim: true }, // e.g. "vvit.edu"
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now },
});

// Normalize college name for fuzzy matching
CollegeSchema.statics.normalizeName = function (name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.\-_,]/g, '')
    .replace(/\b(inst(itution)?|institute|of|technology|college|university|engineering|autonomous)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Index for fast lookup (normalizedName already has unique index from schema definition)
CollegeSchema.index({ status: 1 });

export default mongoose.models.College || mongoose.model('College', CollegeSchema);
