import { baseLayout } from "./_base.js";

/**
 * Email Verification OTP
 * @param {{ fullName: string, otp: string, expiresIn?: string }} data
 * @returns {{ subject: string, html: string }}
 */
export const emailVerify = ({ fullName, otp, expiresIn = "10 minutes" }) => {
  const firstName = fullName?.split(" ")[0] || "there";

  const body = /* html */ `
    <div class="email-badge">Verify Email</div>

    <h1 class="email-title">Confirm your email address</h1>

    <p class="email-text">
      Hey <strong>${firstName}</strong>, welcome to Erovians! 
      Use the code below to verify your email and activate your account.
    </p>

    <div class="otp-block">
      <div class="otp-label">Your verification code</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">Expires in <span>${expiresIn}</span></div>
    </div>

    <p class="email-text">
      Enter this code in the app to complete your registration. 
      Do not share this code with anyone.
    </p>

    <div class="alert-warning">
      🔒 Erovians will never ask for this code via phone or chat. 
      If someone is asking — it's a scam.
    </div>
  `;

  return {
    subject: `${otp} is your Erovians verification code`,
    html: baseLayout({
      previewText: `Your Erovians verification code is ${otp}. Expires in ${expiresIn}.`,
      title: "Verify your email — Erovians",
      body,
    }),
  };
};
