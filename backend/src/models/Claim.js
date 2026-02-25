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
  eSignatures: [eSignatureSchema],
  statusHistory: [historySchema],
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

claimSchema.index({ product: 1, status: 1 });
claimSchema.index({ statement: 1 });

module.exports = mongoose.model('Claim', claimSchema);
