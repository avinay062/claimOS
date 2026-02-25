const mongoose = require('mongoose');

const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'cancelled'];

const milestoneSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  dueDate:    { type: Date },
  completedAt:{ type: Date },
  notes:      { type: String },
}, { _id: true, timestamps: false });

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters'],
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  status: {
    type: String,
    enum: PROJECT_STATUSES,
    default: 'active',
  },

  // Stakeholder roles
  managerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  legalReviewerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  regulatoryApproverId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Claim references (many-to-many via embedded array for projects — reasonable scale)
  claimIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Claim' }],

  // Local adaptation references
  localAdaptationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LocalAdaptation' }],

  milestones: [milestoneSchema],

  targetLaunchDate: { type: Date },
  completedAt:      { type: Date },

  // Denormalized counts for dashboard
  claimsCount:          { type: Number, default: 0 },
  approvedClaimsCount:  { type: Number, default: 0 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

// Virtual: progress percentage based on approved vs total claims
projectSchema.virtual('progressPct').get(function () {
  if (!this.claimsCount) return 0;
  return Math.round((this.approvedClaimsCount / this.claimsCount) * 100);
});

projectSchema.index({ status: 1 });
projectSchema.index({ managerId: 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ name: 'text', description: 'text' });

const Project = mongoose.model('Project', projectSchema);
module.exports = { Project, PROJECT_STATUSES };
