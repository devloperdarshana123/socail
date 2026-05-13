import { baseLayout } from "./_base.js";

/**
 * New Device Login Alert — triggered when a new refreshToken is added
 * @param {{ fullName: string, deviceInfo: string, ipAddress?: string, time?: string }} data
 * @returns {{ subject: string, html: string }}
 */
export const newDeviceLogin = ({ fullName, deviceInfo, ipAddress, time }) => {
  const firstName = fullName?.split(" ")[0] || "there";
  const loginTime = time || new Date().toUTCString();

  // Mask IP for privacy e.g. 192.168.x.x
  const maskedIp = ipAddress
    ? ipAddress
        .split(".")
        .map((p, i) => (i >= 2 ? "x" : p))
        .join(".")
    : "Unknown";

  const body = /* html */ `
    <div class="email-badge">Security Alert</div>

    <h1 class="email-title">New login detected on your account</h1>

    <p class="email-text">
      Hey <strong>${firstName}</strong>, we noticed a sign-in to your Erovians account 
      from a new device. Here are the details:
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-key">Device</span>
        <span class="info-val">${deviceInfo || "Unknown device"}</span>
      </div>
      <div class="info-row">
        <span class="info-key">IP Address</span>
        <span class="info-val">${maskedIp}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Time</span>
        <span class="info-val">${loginTime}</span>
      </div>
    </div>

    <div class="alert-success">
      ✅ If this was you — no action needed. You're all good.
    </div>

    <div class="alert-danger">
      🚨 If this wasn't you — change your password immediately and remove all active sessions 
      from your account settings.
    </div>

    <p class="email-text" style="font-size:13px;">
      You can manage your active sessions and trusted devices from 
      <strong>Settings → Security → Active Sessions</strong>.
    </p>
  `;

  return {
    subject: `New login to your Erovians account`,
    html: baseLayout({
      previewText: `A new device just signed into your Erovians account. Review the details.`,
      title: "New device login — Erovians",
      body,
    }),
  };
};
