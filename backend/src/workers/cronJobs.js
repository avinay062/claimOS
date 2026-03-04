const cron = require('node-cron');
const WorkflowTask = require('../models/WorkflowTask');
const Claim = require('../models/Claim');
const Substantiation = require('../models/Substantiation');
const { notify } = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');

const startAllCrons = () => {
  // ── Every hour: mark overdue tasks ──────────────────────────────
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

  // ── Daily 8am: due-soon reminders (tasks due in next 24h) ───────
  cron.schedule('0 8 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dueSoon = await WorkflowTask.find({
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $gte: new Date(), $lte: tomorrow },
      }).populate('assignedTo', 'name email');

      for (const task of dueSoon) {
        if (!task.assignedTo) continue;
        await notify({
          userId: task.assignedTo._id,
          type: 'task_due_soon',
          title: `Task due soon: "${task.title}"`,
          message: `This task is due ${task.dueDate.toLocaleDateString()}`,
          link: '/tasks',
        });
        await sendEmail({
          to: task.assignedTo.email,
          subject: `⏰ Task due soon: ${task.title}`,
          html: `<p>Hi ${task.assignedTo.name},</p><p>Your task <strong>${task.title}</strong> is due on ${task.dueDate.toLocaleDateString()}. Please complete it on time.</p>`,
        });
      }
      if (dueSoon.length > 0) console.log(`📬 Sent ${dueSoon.length} due-soon reminders`);
    } catch (err) {
      console.error('Cron error (due-soon reminders):', err.message);
    }
  });

  // ── Daily 9am: claim reassessment alerts ────────────────────────
  cron.schedule('0 9 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dueForReassessment = await Claim.find({
        reassessmentDueDate: { $gte: today, $lt: tomorrow },
        status: 'Approved',
      }).populate('createdBy', 'name email');

      for (const claim of dueForReassessment) {
        if (!claim.createdBy) continue;
        await notify({
          userId: claim.createdBy._id,
          type: 'claim_reassessment',
          title: `Claim reassessment due: "${claim.title}"`,
          message: 'This approved claim is due for reassessment today.',
          link: `/claims/${claim._id}`,
        });
        await sendEmail({
          to: claim.createdBy.email,
          subject: `🔄 Claim reassessment due: ${claim.title}`,
          html: `<p>Hi ${claim.createdBy.name},</p><p>The approved claim <strong>${claim.title}</strong> is due for reassessment today. Please review and update it.</p>`,
        });
      }
      if (dueForReassessment.length > 0) console.log(`🔄 Sent ${dueForReassessment.length} reassessment alerts`);
    } catch (err) {
      console.error('Cron error (reassessment alerts):', err.message);
    }
  });

  // ── Daily 10am: substantiation expiry alerts ────────────────────
  cron.schedule('0 10 * * *', async () => {
    try {
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);

      const expiring = await Substantiation.find({
        status: 'Approved',
        expiryDate: { $lte: in30Days, $gte: new Date() },
      }).populate('createdBy', 'name email');

      for (const sub of expiring) {
        if (!sub.createdBy) continue;
        const daysLeft = Math.round((sub.expiryDate - new Date()) / 86400000);
        await notify({
          userId: sub.createdBy._id,
          type: 'substantiation_expiring',
          title: `Substantiation expiring in ${daysLeft} days: "${sub.title}"`,
          link: `/substantiations/${sub._id}`,
        });
      }
      if (expiring.length > 0) console.log(`⚠️  Sent ${expiring.length} substantiation expiry alerts`);
    } catch (err) {
      console.error('Cron error (substantiation expiry):', err.message);
    }
  });

  console.log('✅ Overdue task cron scheduled (hourly)');
  console.log('✅ Due-soon reminder cron scheduled (daily 8am)');
  console.log('✅ Reassessment alert cron scheduled (daily 9am)');
  console.log('✅ Substantiation expiry cron scheduled (daily 10am)');
};

module.exports = { startAllCrons };
