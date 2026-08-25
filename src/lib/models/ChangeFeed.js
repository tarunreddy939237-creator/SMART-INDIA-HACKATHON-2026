import mongoose from 'mongoose';

/**
 * ChangeFeed — Lightweight event log for real-time polling.
 * Students poll this endpoint with their last-seen timestamp.
 * Only events matching their target audience are returned.
 * Events auto-expire after 24 hours (TTL index).
 */
const ChangeFeedSchema = new mongoose.Schema({
  eventType:    { type: String, required: true },  // e.g. "academic_event_created"
  entityId:     { type: mongoose.Schema.Types.ObjectId, required: true },
  entityModel:  { type: String, default: 'AcademicEvent' },

  // Target audience for server-side filtering
  targetAudience: {
    branch:     { type: String, default: '' },
    year:       { type: Number, default: 0 },
    semester:   { type: Number, default: 0 },
    section:    { type: String, default: '' },
    subject:    { type: String, default: '' },
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  data:      { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true },
});

// TTL: auto-delete after 24 hours
ChangeFeedSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });
ChangeFeedSchema.index({ 'targetAudience.branch': 1, 'targetAudience.section': 1, timestamp: -1 });

export default mongoose.models.ChangeFeed || mongoose.model('ChangeFeed', ChangeFeedSchema);
