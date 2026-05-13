// ─────────────────────────────────────────────
//  Email Templates — Central Index
//  Usage: import { sendTemplateMail } from "./emails/index.js"
// ─────────────────────────────────────────────

import { emailVerify } from "./templates/emailVerify.js";
import { mobileVerify } from "./templates/mobileVerify.js";
import { forgotPassword } from "./templates/forgotPassword.js";
import { welcome } from "./templates/welcome.js";
import { newDeviceLogin } from "./templates/newDeviceLogin.js";
import { passwordChanged } from "./templates/passwordChanged.js";
import { accountSuspended } from "./templates/accountSuspended.js";
import { sendMail } from "../utils/sendMail.js";

// ─────────────────────────────────────────────
//  Template Registry
// ─────────────────────────────────────────────

const templates = {
  emailVerify,
  mobileVerify,
  forgotPassword,
  welcome,
  newDeviceLogin,
  passwordChanged,
  accountSuspended,
};

// ─────────────────────────────────────────────
//  sendTemplateMail — main wrapper
//
//  @param {string} templateName  — key from templates above
//  @param {object} data          — dynamic data for the template
//  @param {string} to            — recipient email
//  @param {string} [toName]      — recipient display name (optional)
//
//  Example:
//    await sendTemplateMail("emailVerify", { fullName: "Rahul", otp: "482910" }, "rahul@gmail.com")
//    await sendTemplateMail("newDeviceLogin", { fullName, deviceInfo, ipAddress }, user.email)
// ─────────────────────────────────────────────

export const sendTemplateMail = async (templateName, data, to, toName) => {
  const templateFn = templates[templateName];

  if (!templateFn) {
    throw new Error(
      `Email template "${templateName}" not found. Available: ${Object.keys(templates).join(", ")}`,
    );
  }

  const { subject, html } = templateFn(data);

  return sendMail({ to, toName, subject, html });
};

// Named exports for direct use if needed
export {
  emailVerify,
  mobileVerify,
  forgotPassword,
  welcome,
  newDeviceLogin,
  passwordChanged,
  accountSuspended,
};
