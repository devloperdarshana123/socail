import { baseLayout } from "./_base.js";

export const accountSuspended = ({ fullName, reason, status, expiresAt }) => {
  const firstName = fullName?.split(" ")[0] || "there";
  const isBanned      = status === "banned";
  const isDeactivated = status === "deactivated";

  const badge = isBanned
    ? " Account Banned"
    : isDeactivated
    ? " Account Deactivated"
    : " Account Suspended";

  const title = isBanned
    ? "Your account has been permanently banned"
    : isDeactivated
    ? "Your account has been deactivated"
    : "Your account has been temporarily suspended";

  const description = isBanned
    ? `After a thorough review, your Erovians account has been <strong>permanently banned</strong> due to repeated or severe violations of our community guidelines.`
    : isDeactivated
    ? `Your Erovians account has been <strong>deactivated</strong> by our moderation team.`
    : `Your Erovians account has been <strong>temporarily suspended</strong>. During this period, you won't be able to access your account.`;

  const body = `
    <div class="email-badge" style="background:rgba(239,68,68,0.1);color:#F87171;border-color:rgba(239,68,68,0.2);">
      ${badge}
    </div>

    <h1 class="email-title">${title}</h1>

    <p class="email-text">Hi <strong>${firstName}</strong>,</p>

    <p class="email-text">${description}</p>

    <div class="info-card" style="padding: 20px 24px;">
  <div class="info-row" style="padding: 10px 0;">
    <span class="info-key">Account</span>
    <span style="color:#4B5563;">:</span>
    <span class="info-val">${fullName}</span>
  </div>
  <div class="info-row" style="padding: 10px 0;">
    <span class="info-key">Status</span>
    <span style="color:#4B5563;">:</span>
    <span class="info-val" style="color:#F87171;font-weight:600;">
      ${isBanned ? "Permanently Banned" : isDeactivated ? "Deactivated" : "Suspended"}
    </span>
  </div>
  ${reason ? `
  <div class="info-row" style="padding: 10px 0;">
    <span class="info-key">Reason</span>
    <span style="color:#4B5563;">:</span>
    <span class="info-val">${reason}</span>
  </div>` : ""}
  ${!isBanned && !isDeactivated && expiresAt ? `
  <div class="info-row" style="padding: 10px 0;">
    <span class="info-key">Suspended Until</span>
    <span style="color:#4B5563;">:</span>
    <span class="info-val">${new Date(expiresAt).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric"
    })}</span>
  </div>` : ""}
</div>

    <div class="alert-danger">
      ${isBanned
        ? "🔒 This ban is permanent. You will not be able to create a new account using the same credentials."
        : isDeactivated
        ? "⚠️ Your account has been deactivated. Please contact support if you believe this was a mistake."
        : "🚫 You will regain access to your account once the suspension period ends."}
    </div>

    <div class="email-divider"></div>

    <p class="email-text" style="font-size:13px;">
      If you believe this action was taken in error, please reach out to our support team. 
      We review all appeals thoroughly.
    </p>
  `;

  const html = baseLayout({
    previewText: badge,
    title,
    body,
  });

  return { subject: title, html };
};