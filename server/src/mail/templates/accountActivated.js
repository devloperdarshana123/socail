import { baseLayout } from "./_base.js";

export const accountActivated = ({ fullName }) => {
  const firstName = fullName?.split(" ")[0] || "there";

  const body = `
    <div class="email-badge" style="background:rgba(16,185,129,0.1);color:#6EE7B7;border-color:rgba(16,185,129,0.2);">
      ✅ Account Reactivated
    </div>

    <h1 class="email-title">Your account is active again!</h1>

    <p class="email-text">
      Hey <strong>${firstName}</strong>, your suspension period has ended. Your Erovians account is now fully active and you can access all features.
    </p>

    <div class="alert-success">
      ✅ Welcome back! You can now post, comment, and interact with other users.
    </div>

    <div class="email-divider"></div>

    <p class="email-text">
      If you have any questions, feel free to contact our support team.
    </p>
  `;

  return {
    subject: "Your Erovians account has been reactivated",
    html: baseLayout({
      previewText: "Your account suspension has ended",
      title: "Account reactivated",
      body,
    }),
  };
};