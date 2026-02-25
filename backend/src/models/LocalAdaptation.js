const mongoose = require('mongoose');

const LOCAL_ADAPTATION_STATUSES = [
  'proposed',
  'in_review',
  'approved',
  'rejected',
  'withdrawn',
];

const MARKETING_CHANNELS = [
  'tv', 'digital', 'print', 'packaging', 'social_media',
  'point_of_sale', 'radio', 'outdoor', 'email', 'influencer',
];

const workflowEventSchema = new mongoose.Schema({
  fromStatus: { type: String },
  toStatus:   { type: String, required: true },
  performedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comment:    { type: String },
  timestamp:  { type: Date, default: Date.now },
}, { _id: false });

const localAdaptationSchema = new mongoose.Schema({
  // Parent claim this adaptation derives from
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Claim',
    required: [true, 'Claim is required'],
  },

  // Source adaptation (if copied from another)
  sourcedFromId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LocalAdaptation',
    default: null,
  },

  // Project it belongs to
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
  },

  // Location
  locationCode: {
    type: String,
    required: [true, 'Location code is required'],
    uppercase: true,
    trim: true,
  },
  locationName: { type: String }, // denormalized snapshot

  // Language / locale for this adaptation
  locale: {
    type: String,
    required: [true, 'Locale is required'],
    trim: true,
    // e.g. 'fr-FR'
  },

  // The adapted claim text (translated / locally modified)
  localText: {
    type: String,
    required: [true, 'Local text is required'],
    trim: true,
    maxlength: [1000, 'Local text cannot exceed 1000 characters'],
  },

  // Channels this claim is approved for in this country
  permittedChannels: {
    type: [String],
    enum: MARKETING_CHANNELS,
    default: [],
  },

  status: {
    type: String,
    enum: LOCAL_ADAPTATION_STATUSES,
    default: 'proposed',
  },

  // Local substantiations specific to this market
  localSubstantiationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Substantiation' }],

  workflowHistory: [workflowEventSchema],

  notes: { type: String, maxlength: 1000 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

// One adaptation per claim + country + locale
localAdaptationSchema.index({ claimId: 1, locationCode: 1, locale: 1 }, { unique: true });
localAdaptationSchema.index({ status: 1 });
localAdaptationSchema.index({ locationCode: 1 });
localAdaptationSchema.index({ projectId: 1 });
localAdaptationSchema.index({ createdAt: -1 });
localAdaptationSchema.index({ localText: 'text' });

const LocalAdaptation = mongoose.model('LocalAdaptation', localAdaptationSchema);
module.exports = { LocalAdaptation, LOCAL_ADAPTATION_STATUSES, MARKETING_CHANNELS };
