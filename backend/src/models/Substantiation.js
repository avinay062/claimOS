const mongoose = require('mongoose');

const substantiationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ['Clinical Study', 'Consumer Research', 'Expert Opinion', 'Regulatory Filing', 'Internal Test', 'Other'],
    required: true,
  },
  status: {
    type: String,
    enum: ['Draft', 'Under Review', 'Approved', 'Expired'],
    default: 'Draft',
  },
  description: String,
  expiryDate: Date,
  file: {
    originalName: String,
    key: String,          // S3 key or memory ref
    size: Number,
    mimeType: String,
    uploadedAt: Date,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Substantiation', substantiationSchema);
