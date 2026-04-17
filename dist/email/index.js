import { Resend } from 'resend';

// src/email/resend.ts
var client;
function getClient() {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(apiKey);
  }
  return client;
}
async function sendEmail({ to, subject, html, replyTo, from }) {
  const defaultFrom = process.env.RESEND_FROM;
  if (!from && !defaultFrom) {
    throw new Error("No from address provided and RESEND_FROM is not set");
  }
  return getClient().emails.send({
    from: from ?? defaultFrom,
    to,
    subject,
    html,
    replyTo
  });
}

export { sendEmail };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map