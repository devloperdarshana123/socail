import { baseLayout } from "./_base.js";

/**
 * Password Changed Confirmation
 * @param {{ fullName: string, time?: string }} data
 * @returns {{ subject: string, html: string }}
 */
export const passwordChanged = ({ fullName, time }) => {
  const firstName = fullName?.split(" ")[0] || "there";
  const changedAt = time || new Date().toUTCString();

  const body = /* html */ `
    <div class="email-badge">Security</div>

    <h1 class="email-title">Your password was changed</h1>

    <p class="email-text">
      Hey <strong>${firstName}</strong>, your Erovians account password was 
      successfully updated.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-key">Account</span>
        <span class="info-val">${fullName}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Changed at</span>
        <span class="info-val">${changedAt}</span>
      </div>
    </div>

    <div class="alert-success">
      ✅ Your account is secure. All active sessions were signed out as a precaution.
    </div>

    <div class="alert-danger">
      🚨 Didn't make this change? Your account may be compromised — contact support immediately 
      and use the "Forgot Password" option to regain access.
    </div>

    <p class="email-text" style="font-size:13px;">
      For your security, we recommend using a strong, unique password and enabling 
      two-step verification from <strong>Settings → Security</strong>.
    </p>
  `;

  return {
    subject: `Your Erovians password was changed`,
    html: baseLayout({
      previewText: `Your Erovians password was successfully updated. Didn't do this? Act now.`,
      title: "Password changed — Erovians",
      body,
    }),
  };
};
