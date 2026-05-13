import { baseLayout } from "./_base.js";

/**
 * Welcome Email — sent after onboarding is complete (step 3)
 * @param {{ fullName: string, username: string }} data
 * @returns {{ subject: string, html: string }}
 */
export const welcome = ({ fullName, username }) => {
  const firstName = fullName?.split(" ")[0] || "there";

  const body = /* html */ `
    <div class="email-badge">Welcome</div>

    <h1 class="email-title">You're all set, ${firstName} 🎉</h1>

    <p class="email-text">
      Your Erovians account is ready. You're now part of a community built for real connections —
      no noise, just the people and content that matter to you.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-key">Username</span>
        <span class="info-val">@${username}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Display name</span>
        <span class="info-val">${fullName}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Account status</span>
        <span class="info-val" style="color:#6EE7B7;">Active ✓</span>
      </div>
    </div>

    <p class="email-text">
      Here's what you can do next — complete your profile, follow people you know, 
      and share your first post. The feed is waiting.
    </p>

    <div class="email-divider"></div>

    <p class="email-text" style="font-size:13px;">
      If anything feels off or you need help, reach out to us anytime. 
      We're here.
    </p>
  `;

  return {
    subject: `Welcome to Erovians, ${firstName}!`,
    html: baseLayout({
      previewText: `Your account is ready. Start exploring Erovians, @${username}.`,
      title: "Welcome to Erovians",
      body,
    }),
  };
};
