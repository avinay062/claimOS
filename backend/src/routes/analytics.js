const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const Statement = require('../models/Statement');
const Substantiation = require('../models/Substantiation');
const { LocalAdaptation } = require('../models/LocalAdaptation');
const { Project } = require('../models/Project');
const WorkflowTask = require('../models/WorkflowTask');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// GET /api/analytics/overview — top-level KPIs
router.get('/overview', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);
    const createdFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const [
      totalClaims, totalStatements, totalSubstantiations, totalAdaptations,
      claimsByStatus, statementsByStatus, substByStatus,
      approvedThisPeriod, rejectedThisPeriod,
      avgTimeToApproval,
    ] = await Promise.all([
      Claim.countDocuments(),
      Statement.countDocuments(),
      Substantiation.countDocuments(),
      LocalAdaptation.countDocuments(),
      Claim.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Statement.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Substantiation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Claim.countDocuments({ status: 'Approved', ...createdFilter }),
      Claim.countDocuments({ status: 'Rejected', ...createdFilter }),
      Claim.aggregate([
        { $match: { status: 'Approved', statusHistory: { $exists: true, $ne: [] } } },
        { $addFields: {
          createdDate: '$createdAt',
          approvedEntry: { $filter: { input: '$statusHistory', as: 'h', cond: { $eq: ['$$h.to', 'Approved'] } } }
        }},
        { $addFields: { approvedAt: { $arrayElemAt: ['$approvedEntry.at', 0] } } },
        { $match: { approvedAt: { $exists: true } } },
        { $addFields: { daysToApproval: { $divide: [{ $subtract: ['$approvedAt', '$createdAt'] }, 86400000] } } },
        { $group: { _id: null, avgDays: { $avg: '$daysToApproval' } } },
      ]),
    ]);

    res.json({
      totals: { claims: totalClaims, statements: totalStatements, substantiations: totalSubstantiations, adaptations: totalAdaptations },
      claimsByStatus: Object.fromEntries(claimsByStatus.map(x => [x._id, x.count])),
      statementsByStatus: Object.fromEntries(statementsByStatus.map(x => [x._id, x.count])),
      substantiationsByStatus: Object.fromEntries(substByStatus.map(x => [x._id, x.count])),
      approvedThisPeriod,
      rejectedThisPeriod,
      avgDaysToApproval: avgTimeToApproval[0]?.avgDays ? Math.round(avgTimeToApproval[0].avgDays) : null,
      approvalRate: approvedThisPeriod + rejectedThisPeriod > 0
        ? Math.round((approvedThisPeriod / (approvedThisPeriod + rejectedThisPeriod)) * 100)
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/claims-over-time — claims created per month
router.get('/claims-over-time', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const since = new Date();
    since.setMonth(since.getMonth() - Number(months));

    const data = await Claim.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, status: '$status' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/risk — risk distribution of claims
router.get('/risk', async (req, res) => {
  try {
    const [byRisk, highRiskClaims] = await Promise.all([
      Claim.aggregate([{ $group: { _id: '$riskLevel', count: { $sum: 1 } } }]),
      Claim.find({ riskLevel: 'high' })
        .select('title status riskLevel flaggedWords product')
        .populate('product', 'name')
        .sort('-updatedAt')
        .limit(20),
    ]);

    res.json({
      byRisk: Object.fromEntries(byRisk.map(x => [x._id || 'unrated', x.count])),
      highRiskClaims,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/localization — adaptation coverage per country
router.get('/localization', async (req, res) => {
  try {
    const [byCountry, byStatus, totalClaims] = await Promise.all([
      LocalAdaptation.aggregate([
        { $group: { _id: '$locationCode', count: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),
      LocalAdaptation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Claim.countDocuments({ status: 'Approved' }),
    ]);

    const countries = byCountry.map(c => ({
      locationCode: c._id,
      total: c.count,
      approved: c.approved,
      coverage: totalClaims > 0 ? Math.round((c.count / totalClaims) * 100) : 0,
    }));

    res.json({
      byCountry: countries,
      byStatus: Object.fromEntries(byStatus.map(x => [x._id, x.count])),
      totalClaims,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/tasks — workflow task performance
router.get('/tasks', async (req, res) => {
  try {
    const [byStatus, overdueTasks, completedThisMonth, avgCompletionDays] = await Promise.all([
      WorkflowTask.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      WorkflowTask.find({ status: 'overdue' })
        .populate('assignedTo', 'name email')
        .select('title dueDate priority')
        .sort('dueDate')
        .limit(20),
      WorkflowTask.countDocuments({
        status: 'completed',
        completedAt: { $gte: new Date(new Date().setDate(1)) }, // start of month
      }),
      WorkflowTask.aggregate([
        { $match: { status: 'completed', completedAt: { $exists: true } } },
        { $addFields: { daysToComplete: { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 86400000] } } },
        { $group: { _id: null, avgDays: { $avg: '$daysToComplete' } } },
      ]),
    ]);

    res.json({
      byStatus: Object.fromEntries(byStatus.map(x => [x._id, x.count])),
      overdueTasks,
      completedThisMonth,
      avgCompletionDays: avgCompletionDays[0]?.avgDays ? Math.round(avgCompletionDays[0].avgDays * 10) / 10 : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/users — per-user activity (admin only)
router.get('/users', authorize('admin'), async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [activityByUser, userList] = await Promise.all([
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$user', actions: { $sum: 1 } } },
        { $sort: { actions: -1 } },
        { $limit: 20 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { name: '$user.name', email: '$user.email', role: '$user.role', actions: 1 } },
      ]),
      User.find().select('name email role isActive createdAt').sort('-createdAt').limit(100),
    ]);

    res.json({ activityByUser, userList, totalUsers: userList.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/export — CSV export of claims data
router.get('/export', authorize('admin', 'regulatory_approver'), async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('statement', 'text category')
      .populate('product', 'name sku')
      .populate('createdBy', 'name email')
      .sort('-createdAt')
      .limit(5000)
      .lean();

    const headers = ['ID', 'Title', 'Statement', 'Product', 'SKU', 'Status', 'Risk Level', 'Channels', 'Regions', 'Created By', 'Created At', 'Updated At'];
    const rows = claims.map(c => [
      c._id, c.title,
      c.statement?.text?.replace(/,/g, ';') || '',
      c.product?.name || '',
      c.product?.sku || '',
      c.status,
      c.riskLevel || 'unrated',
      (c.channel || []).join(';'),
      (c.region || []).join(';'),
      c.createdBy?.email || '',
      c.createdAt?.toISOString(),
      c.updatedAt?.toISOString(),
    ]);

    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="claims-export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
