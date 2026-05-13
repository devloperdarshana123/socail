// ─────────────────────────────────────────────
//  Base Email Layout
//  Shared wrapper for all Erovians email templates
//  Logo URL: replace LOGO_URL with your Cloudinary URL
// ─────────────────────────────────────────────

const LOGO_URL =
  "https://res.cloudinary.com/YOUR_CLOUD/image/upload/erovians-logo.png";
const BRAND_COLOR = "#6C47FF"; // primary purple
const BRAND_DARK = "#0D0D0D"; // near-black bg
const BRAND_CARD = "#161616"; // card bg
const BRAND_MUTED = "#9CA3AF"; // muted text
const BRAND_BORDER = "#2A2A2A"; // subtle border

export const baseLayout = ({
  previewText = "",
  title = "",
  body = "",
}) => /* html */ `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${title}</title>

  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->

  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body, #bodyTable {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: ${BRAND_DARK};
      font-family: 'DM Sans', Arial, sans-serif;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    img { border: 0; outline: none; text-decoration: none; display: block; }

    .email-wrapper {
      width: 100%;
      background-color: ${BRAND_DARK};
      padding: 48px 16px;
    }

    .email-card {
      max-width: 560px;
      margin: 0 auto;
      background-color: ${BRAND_CARD};
      border-radius: 16px;
      border: 1px solid ${BRAND_BORDER};
      overflow: hidden;
    }

    /* ── Header ── */
    .email-header {
      padding: 32px 40px 24px;
      border-bottom: 1px solid ${BRAND_BORDER};
      text-align: left;
    }

    .email-logo {
      height: 28px;
      width: auto;
    }

    /* ── Body ── */
    .email-body {
      padding: 36px 40px;
    }

    .email-badge {
      display: inline-block;
      background: rgba(108,71,255,0.12);
      color: ${BRAND_COLOR};
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 100px;
      border: 1px solid rgba(108,71,255,0.25);
      margin-bottom: 20px;
    }

    h1.email-title {
      color: #FFFFFF;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.35;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }

    p.email-text {
      color: ${BRAND_MUTED};
      font-size: 15px;
      line-height: 1.65;
      margin-bottom: 12px;
    }

    p.email-text strong {
      color: #E5E7EB;
      font-weight: 500;
    }

    /* ── OTP Block ── */
    .otp-block {
      margin: 28px 0;
      background: rgba(108,71,255,0.07);
      border: 1px solid rgba(108,71,255,0.2);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }

    .otp-label {
      color: ${BRAND_MUTED};
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .otp-code {
      font-family: 'DM Mono', 'Courier New', monospace;
      font-size: 40px;
      font-weight: 500;
      letter-spacing: 0.15em;
      color: #FFFFFF;
      line-height: 1;
    }

    .otp-expiry {
      color: ${BRAND_MUTED};
      font-size: 12px;
      margin-top: 12px;
    }

    .otp-expiry span {
      color: #F59E0B;
      font-weight: 500;
    }

    /* ── CTA Button ── */
    .btn-primary {
      display: inline-block;
      background: ${BRAND_COLOR};
      color: #FFFFFF !important;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none !important;
      padding: 13px 28px;
      border-radius: 10px;
      margin: 20px 0;
      letter-spacing: -0.01em;
    }

    /* ── Info Card (device/security info) ── */
    .info-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid ${BRAND_BORDER};
      border-radius: 10px;
      padding: 16px 20px;
      margin: 24px 0;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }

    .info-row + .info-row {
      border-top: 1px solid ${BRAND_BORDER};
    }

    .info-key {
      color: ${BRAND_MUTED};
      font-size: 12px;
      font-weight: 500;
    }

    .info-val {
      color: #E5E7EB;
      font-size: 12px;
      font-weight: 500;
      text-align: right;
      max-width: 60%;
      word-break: break-all;
    }

    /* ── Alert Banner ── */
    .alert-banner {
      border-radius: 10px;
      padding: 14px 18px;
      margin: 24px 0;
      font-size: 13px;
      line-height: 1.5;
    }

    .alert-warning {
      background: rgba(245,158,11,0.08);
      border: 1px solid rgba(245,158,11,0.2);
      color: #FCD34D;
    }

    .alert-danger {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      color: #FCA5A5;
    }

    .alert-success {
      background: rgba(16,185,129,0.08);
      border: 1px solid rgba(16,185,129,0.2);
      color: #6EE7B7;
    }

    /* ── Divider ── */
    .email-divider {
      height: 1px;
      background: ${BRAND_BORDER};
      margin: 28px 0;
    }

    /* ── Footer ── */
    .email-footer {
      padding: 20px 40px 28px;
      border-top: 1px solid ${BRAND_BORDER};
      text-align: center;
    }

    .footer-text {
      color: #4B5563;
      font-size: 12px;
      line-height: 1.6;
    }

    .footer-text a {
      color: #6B7280;
      text-decoration: none;
    }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      .email-header, .email-body, .email-footer { padding-left: 24px !important; padding-right: 24px !important; }
      .otp-code { font-size: 32px !important; }
      h1.email-title { font-size: 20px !important; }
    }
  </style>
</head>

<body>
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:${BRAND_DARK};">
    ${previewText}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <div class="email-wrapper">
    <div class="email-card">

      <!-- Header -->
      <div class="email-header">
        <img src="${LOGO_URL}" alt="Erovians" class="email-logo" />
      </div>

      <!-- Body -->
      <div class="email-body">
        ${body}
      </div>

      <!-- Footer -->
      <div class="email-footer">
        <p class="footer-text">
          This email was sent by Erovians. If you didn't request this, you can safely ignore it.<br />
          &copy; ${new Date().getFullYear()} Erovians. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
`;
