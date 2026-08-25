import mongoose from 'mongoose';

const CollegeAdminSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  role:      { type: String, enum: ['college_admin', 'super_admin'], default: 'college_admin' },
  createdAt: { type: Date, default: Date.now },
});

// One admin per college (unless super_admin)
CollegeAdminSchema.index({ collegeId: 1, role: 1 });
CollegeAdminSchema.index({ userId: 1 }, { unique: true });

export default mongoose.models.CollegeAdmin || mongoose.model('CollegeAdmin', CollegeAdminSchema);
