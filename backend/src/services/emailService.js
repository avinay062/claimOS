const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    console.log(`📧 [DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return;
  }
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, html });
};

module.exports = { sendEmail };
