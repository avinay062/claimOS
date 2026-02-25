const mongoose = require('mongoose');

const claimSubstantiationSchema = new mongoose.Schema({
  claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
  substantiation: { type: mongoose.Schema.Types.ObjectId, ref: 'Substantiation', required: true },
  linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

claimSubstantiationSchema.index({ claim: 1, substantiation: 1 }, { unique: true });

module.exports = mongoose.model('ClaimSubstantiation', claimSubstantiationSchema);
