const WorkflowTask = require('../models/WorkflowTask');
const { notify } = require('./notificationService');
const { sendEmail } = require('./emailService');
const User = require('../models/User');

const createTask = async ({ title, description, assignedTo, createdBy, entity, entityId, priority, dueDate }) => {
  const task = await WorkflowTask.create({
    title, description, assignedTo, createdBy, entity, entityId, priority, dueDate,
  });

  const assignee = await User.findById(assignedTo);
  if (assignee) {
    await notify({
      userId: assignedTo,
      type: 'task_assigned',
      title: 'New task assigned',
      message: title,
      link: `/tasks`,
    });
    await sendEmail({
      to: assignee.email,
      subject: `New task: ${title}`,
      html: `<p>Hi ${assignee.name},</p><p>You have been assigned a new task: <strong>${title}</strong></p>`,
    });
  }

  return task;
};

module.exports = { createTask };
