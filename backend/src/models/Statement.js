const mongoose = require('mongoose');

const translationSchema = new mongoose.Schema({
  language: { type: String, required: true },
  text: { type: String, required: true },
  translatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  translatedAt: Date,
}, { _id: false });

const statementSchema = new mongoose.Schema({
  text: { type: String, required: true },
  category: { type: String, required: true },
  status: {
    type: String,
    enum: ['Draft', 'In Review', 'In Use', 'Retired'],
    default: 'Draft',
  },
  tags: [String],
  translations: [translationSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

statementSchema.index({ text: 'text', tags: 1, status: 1 });

module.exports = mongoose.model('Statement', statementSchema);
