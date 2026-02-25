const mongoose = require('mongoose');

const workflowTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  entity: { type: String, enum: ['claim', 'statement', 'substantiation'] },
  entityId: mongoose.Schema.Types.ObjectId,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'overdue'],
    default: 'pending',
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: Date,
  completedAt: Date,
  completionNote: String,
}, { timestamps: true });

workflowTaskSchema.index({ assignedTo: 1, status: 1 });
workflowTaskSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('WorkflowTask', workflowTaskSchema);
