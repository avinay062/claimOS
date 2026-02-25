const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const Statement = require('../models/Statement');
const Substantiation = require('../models/Substantiation');
const WorkflowTask = require('../models/WorkflowTask');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const [claimsByStatus, statsByStatement, substByStatus, myTasks, totalClaims, totalStatements] = await Promise.all([
      Claim.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Statement.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Substantiation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      WorkflowTask.countDocuments({ assignedTo: req.user._id, status: { $in: ['pending', 'in_progress'] } }),
      Claim.countDocuments(),
      Statement.countDocuments(),
    ]);

    res.json({
      claimsByStatus: Object.fromEntries(claimsByStatus.map(x => [x._id, x.count])),
      statementsByStatus: Object.fromEntries(statsByStatement.map(x => [x._id, x.count])),
      substantiationsByStatus: Object.fromEntries(substByStatus.map(x => [x._id, x.count])),
      myPendingTasks: myTasks,
      totalClaims,
      totalStatements,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
