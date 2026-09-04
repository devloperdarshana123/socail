import { baseLayout } from "./_base.js";

/**
 * Forgot Password OTP
 * @param {{ fullName: string, otp: string, expiresIn?: string }} data
 * @returns {{ subject: string, html: string }}
 */
export const forgotPassword = ({ fullName, otp, expiresIn = "10 minutes" }) => {
  const firstName = fullName?.split(" ")[0] || "there";

  const body = /* html */ `
    <div class="email-badge">Password Reset</div>

    <h1 class="email-title">Reset your password</h1>

    <p class="email-text">
      Hey <strong>${firstName}</strong>, we received a request to reset your Erovians password.
      Use the code below to proceed.
    </p>

    <div class="otp-block">
      <div class="otp-label">Your reset code</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">Expires in <span>${expiresIn}</span></div>
    </div>

    <p class="email-text">
      Enter this code in the app to set a new password.
      Once used, this code will be invalid.
    </p>

    <div class="alert-warning">
      ⚠️ If you did not request a password reset, someone may be trying to access your account. 
      Ignore this email and your password will remain unchanged.
    </div>
  `;

  return {
    subject: `Reset your Erovians password`,
    html: baseLayout({
      previewText: `Your Erovians password reset code is ${otp}. Valid for ${expiresIn}.`,
      title: "Reset password — Erovians",
      body,
    }),
  };
};
