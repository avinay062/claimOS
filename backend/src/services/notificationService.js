const Notification = require('../models/Notification');

const notify = async ({ userId, type, title, message, link }) => {
  try {
    await Notification.create({ user: userId, type, title, message, link });
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

module.exports = { notify };
