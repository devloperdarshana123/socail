
import twilio from "twilio";
import logger from "../config/logger.js";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send OTP via SMS using Twilio
 * @param {{ to: string, otp: string }} options
 */
export const sendSms = async ({ to, otp }) => {
  try {
    // Ensure number starts with +
    const formattedNumber = to.startsWith("+") ? to : `+${to}`;

    const message = await client.messages.create({
      body: `Your Erovians OTP is: ${otp}. Valid for 10 minutes. Do not share with anyone.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber,
    });

    logger.info("SMS sent successfully", {
      to: formattedNumber,
      sid: message.sid,
      status: message.status,
    });

    return { success: true, sid: message.sid };
  } catch (error) {
    logger.error("SMS sending failed", {
      to,
      error: error.message,
      code: error.code,
    });
    throw new Error(`SMS service error: ${error.message}`);
  }
};