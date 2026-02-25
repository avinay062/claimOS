const cron = require('node-cron');
const WorkflowTask = require('../models/WorkflowTask');

const startAllCrons = () => {
  // Mark overdue tasks every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await WorkflowTask.updateMany(
        { status: { $in: ['pending', 'in_progress'] }, dueDate: { $lt: new Date() } },
        { status: 'overdue' }
      );
      if (result.modifiedCount > 0) console.log(`⏰ Marked ${result.modifiedCount} tasks as overdue`);
    } catch (err) {
      console.error('Cron error (overdue tasks):', err.message);
    }
  });
  console.log('✅ Overdue task cron scheduled (hourly)');
  console.log('✅ Due-soon reminder cron scheduled (daily 8am)');
  console.log('✅ Reassessment alert cron scheduled (daily 9am)');
};

module.exports = { startAllCrons };
