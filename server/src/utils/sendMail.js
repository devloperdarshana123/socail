

import axios from "axios";
import logger from "../config/logger.js";

export const sendMail = async ({ to, toName, subject, html }) => {
  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: "Erovians",
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
        },
      }
    );

    logger.info("Email sent", { to });
  } catch (error) {
     logger.error("Email error", { 
    error: error.message,
    status: error.response?.status,
    data: error.response?.data 
  });
  }
};