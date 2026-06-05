export const postDeleted = ({ fullName, postCaption, reason, deletedAt }) => {
  const preview = postCaption?.trim()
    ? `"${postCaption.trim().slice(0, 80)}${postCaption.length > 80 ? "…" : ""}"`
    : "No caption";

  const formatted = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(deletedAt));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Post Removed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#ef4444;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                Post Removed
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Hi <strong>${fullName}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Our moderation team has reviewed your content and removed the following post.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f9fafb;border-left:4px solid #ef4444;border-radius:4px;margin:20px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;">Post Caption</p>
                    <p style="margin:0 0 12px;font-size:14px;color:#111827;font-style:italic;">${preview}</p>
                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;">Removed On</p>
                    <p style="margin:0;font-size:14px;color:#111827;">${formatted}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:20px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#b91c1c;">Reason for Removal</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                      ${reason || "Violation of community guidelines"}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                If you believe this was a mistake, please contact our support team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                This is an automated message from the Erovians moderation team. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};