import { baseLayout } from "./_base.js";

/**
 * Mobile Number Verification OTP
 * @param {{ fullName: string, otp: string, phoneNumber?: string, expiresIn?: string }} data
 * @returns {{ subject: string, html: string }}
 */
export const mobileVerify = ({
  fullName,
  otp,
  phoneNumber,
  expiresIn = "10 minutes",
}) => {
  const firstName = fullName?.split(" ")[0] || "there";

  // Mask phone number e.g. +91xxxxxx4210
  const maskedPhone = phoneNumber
    ? phoneNumber.slice(0, 3) + "xxxxxx" + phoneNumber.slice(-4)
    : null;

  const body = /* html */ `
    <div class="email-badge">Mobile Verify</div>

    <h1 class="email-title">Verify your phone number</h1>

    <p class="email-text">
      Hey <strong>${firstName}</strong>, use the code below to verify 
      ${maskedPhone ? `your phone number ending in <strong>${maskedPhone.slice(-4)}</strong>` : "your mobile number"}.
    </p>

    <div class="otp-block">
      <div class="otp-label">Your verification code</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">Expires in <span>${expiresIn}</span></div>
    </div>

    <p class="email-text">
      Enter this code in the Erovians app to link your phone number to your account.
    </p>

    <div class="alert-warning">
      🔒 Never share this code. Erovians will never call or message you asking for it.
    </div>
  `;

  return {
    subject: `${otp} — verify your phone number on Erovians`,
    html: baseLayout({
      previewText: `Your Erovians phone verification code is ${otp}.`,
      title: "Verify phone number — Erovians",
      body,
    }),
  };
};
