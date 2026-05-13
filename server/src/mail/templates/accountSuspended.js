import { baseLayout } from "./_base.js";

/**
 * Account Suspended Notification
 * @param {{ fullName: string, reason?: string }} data
 * @returns {{ subject: string, html: string }}
 */
export const accountSuspended = ({ fullName, reason }) => {
  const firstName = fullName?.split(" ")[0] || "there";

  const body = /* html */ `
    <div class="email-badge" style="background:rgba(239,68,68,0.1);color:#F87171;border-color:rgba(239,68,68,0.2);">
      Account Notice
    </div>

    <h1 class="email-title">Your account has been suspended</h1>

    <p class="email-text">
      Hey <strong>${firstName}</strong>, your Erovians account has been temporarily suspended 
      due to a violation of our community guidelines.
    </p>

    ${
      reason
        ? `
    <div class="info-card">
      <div class="info-row">
        <span class="info-key">Reason</span>
        <span class="info-val">${reason}</span>
      </div>
    </div>
    `
        : ""
    }

    <div class="alert-danger">
      🚫 During the suspension period, you will not be able to access your account, 
      post content, or interact with other users.
    </div>

    <div class="email-divider"></div>

    <p class="email-text">
      If you believe this was a mistake or want to appeal this decision, 
      please contact our support team. We review all appeals carefully.
    </p>

    <p class="email-text" style="font-size:13px; color:#6B7280;">
      Repeated violations may result in a permanent ban. 
      Please review our Community Guidelines before your suspension is lifted.
    </p>
  `;

  return {
    subject: `Important notice about your Erovians account`,
    html: baseLayout({
      previewText: `Your Erovians account has been suspended. Read this for more details.`,
      title: "Account suspended — Erovians",
      body,
    }),
  };
};
