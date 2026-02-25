const express = require('express');
const router = express.Router();
const WorkflowTask = require('../models/WorkflowTask');
const { protect, authorize } = require('../middleware/auth');
const { createTask } = require('../services/workflowTaskService');
const { notify } = require('../services/notificationService');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (req.user.role !== 'admin') query.assignedTo = req.user._id;
    if (status) query.status = status;
    const [data, total] = await Promise.all([
      WorkflowTask.find(query).populate('assignedTo createdBy', 'name email').sort('-createdAt')
        .skip((page - 1) * limit).limit(Number(limit)),
      WorkflowTask.countDocuments(query),
    ]);
    res.json({ data, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my-summary', async (req, res) => {
  try {
    const [pending, overdue] = await Promise.all([
      WorkflowTask.countDocuments({ assignedTo: req.user._id, status: 'pending' }),
      WorkflowTask.countDocuments({ assignedTo: req.user._id, status: 'overdue' }),
    ]);
    res.json({ pending, overdue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const t = await WorkflowTask.findById(req.params.id).populate('assignedTo createdBy', 'name email');
    if (!t) return res.status(404).json({ message: 'Not found' });
    res.json(t);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const task = await createTask({ ...req.body, createdBy: req.user._id });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id/start', async (req, res) => {
  try {
    const t = await WorkflowTask.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (t.assignedTo.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    t.status = 'in_progress';
    await t.save();
    res.json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id/complete', async (req, res) => {
  try {
    const t = await WorkflowTask.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (t.assignedTo.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    t.status = 'completed';
    t.completedAt = new Date();
    t.completionNote = req.body.note;
    await t.save();
    await notify({ userId: t.createdBy, type: 'task_completed', title: `Task completed: ${t.title}`, link: '/tasks' });
    res.json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id/reassign', authorize('admin'), async (req, res) => {
  try {
    const t = await WorkflowTask.findByIdAndUpdate(req.params.id, { assignedTo: req.body.assignedTo }, { new: true });
    res.json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
