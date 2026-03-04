const mongoose = require('mongoose');

// High-risk words / phrases that auto-flag claims for extra review
const riskConfigSchema = new mongoose.Schema({
  word:       { type: String, required: true, trim: true, lowercase: true },
  riskLevel:  { type: String, enum: ['low', 'medium', 'high'], default: 'high' },
  category:   { type: String }, // e.g. "medical", "environmental", "legal"
  notes:      { type: String },
  isActive:   { type: Boolean, default: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

riskConfigSchema.index({ word: 1 }, { unique: true });

const RiskConfig = mongoose.model('RiskConfig', riskConfigSchema);

// Default high-risk words for FMCG/CPG industry
const DEFAULT_RISK_WORDS = [
  { word: 'cure', riskLevel: 'high', category: 'medical' },
  { word: 'treat', riskLevel: 'high', category: 'medical' },
  { word: 'prevent', riskLevel: 'medium', category: 'medical' },
  { word: 'clinically proven', riskLevel: 'high', category: 'medical' },
  { word: 'scientifically proven', riskLevel: 'high', category: 'medical' },
  { word: '100%', riskLevel: 'medium', category: 'quantitative' },
  { word: 'best', riskLevel: 'medium', category: 'superlative' },
  { word: 'safest', riskLevel: 'high', category: 'superlative' },
  { word: 'guaranteed', riskLevel: 'medium', category: 'warranty' },
  { word: 'no side effects', riskLevel: 'high', category: 'medical' },
  { word: 'natural', riskLevel: 'low', category: 'environmental' },
  { word: 'organic', riskLevel: 'low', category: 'environmental' },
];

module.exports = { RiskConfig, DEFAULT_RISK_WORDS };
