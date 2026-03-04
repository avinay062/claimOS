const mongoose = require('mongoose');

const eSignatureSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: String,
  signedAt: { type: Date, default: Date.now },
  comment: String,
}, { _id: false });

const historySchema = new mongoose.Schema({
  from: String,
  to: String,
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
  comment: String,
}, { _id: false });

const claimSchema = new mongoose.Schema({
  title: { type: String, required: true },
  statement: { type: mongoose.Schema.Types.ObjectId, ref: 'Statement', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  status: {
    type: String,
    enum: ['Draft', 'Legal Review', 'Regulatory Review', 'Approved', 'Rejected', 'Retired'],
    default: 'Draft',
  },
  channel: [String],
  region: [String],
  expiryDate: Date,
  // Phase 3 — Risk Assessment
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  riskScore: { type: Number, default: 0 },
  flaggedWords: [{ word: String, riskLevel: String, category: String }],
  reassessmentDueDate: Date,
  // Phase 3 — Project link
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  // Parent/child hierarchy (Phase 2 extension)
  parentClaimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
  copiedFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
  // Workflow
  eSignatures: [eSignatureSchema],
  statusHistory: [historySchema],
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

claimSchema.index({ product: 1, status: 1 });
claimSchema.index({ statement: 1 });
claimSchema.index({ riskLevel: 1 });
claimSchema.index({ projectId: 1 });
claimSchema.index({ title: 'text' });

module.exports = mongoose.model('Claim', claimSchema);
