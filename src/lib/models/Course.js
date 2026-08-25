import mongoose from 'mongoose';

/**
 * Course — Centralized course/subject model.
 * One course per subject per branch (shared across sections).
 * Faculty manages content; students view it.
 */
const CourseSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },  // e.g. "Data Structures"
  code:       { type: String, default: '' },                  // e.g. "CS201"
  description: { type: String, default: '' },

  // Academic scope — which students this course is available to
  branch:     { type: String, required: true },  // "CSE", "ECE", etc.
  year:       { type: Number, default: 0 },       // 1-4, 0 = all years
  semester:   { type: Number, default: 0 },       // 1-8, 0 = all semesters
  sections:   [{ type: String }],                  // ["A", "B"] — which sections take this course

  // Faculty assigned to this course
  facultyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Modules (ordered)
  modules: [{
    title:       { type: String, required: true },
    description: { type: String, default: '' },
    order:       { type: Number, default: 0 },
    materials: [{
      title:     { type: String, required: true },
      type:      { type: String, enum: ['pdf', 'link', 'video', 'note', 'document'], default: 'note' },
      url:       { type: String, default: '' },
      content:   { type: String, default: '' },  // inline text content
      order:     { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now },
    }],
    isPublished: { type: Boolean, default: true },
    createdAt:   { type: Date, default: Date.now },
  }],

  // Stats (computed, denormalized for fast reads)
  studentCount: { type: Number, default: 0 },

  // Status
  isArchived: { type: Boolean, default: false },
  isActive:   { type: Boolean, default: true },

}, { timestamps: true });

CourseSchema.index({ branch: 1, year: 1, semester: 1 });
CourseSchema.index({ facultyIds: 1 });
CourseSchema.index({ branch: 1, sections: 1 });
CourseSchema.index({ name: 'text', description: 'text' });

export default mongoose.models.Course || mongoose.model('Course', CourseSchema);
