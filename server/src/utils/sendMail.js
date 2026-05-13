import { BrevoClient } from "@getbrevo/brevo";
import logger from "../config/logger.js";

if (!process.env.BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY is not set in environment variables");
}
if (!process.env.BREVO_SENDER_EMAIL) {
  throw new Error("BREVO_SENDER_EMAIL is not set in environment variables");
}

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

export const sendMail = async ({ to, toName, subject, html }) => {
  if (!to || !subject || !html) {
    throw new Error("sendMail: 'to', 'subject', and 'html' are required");
  }

  try {
    const response = await client.transactionalEmails.sendTransacEmail({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME || "Erovians",
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    });

    logger.info("Email sent", { to, subject, messageId: response?.messageId });
    return { success: true, messageId: response?.messageId };
  } catch (error) {
    logger.error("Email sending failed", { to, subject, error: error.message });
    throw new Error(`Email service error: ${error.message}`);
  }
};