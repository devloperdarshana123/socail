export const otpEmailTemplate = ({ name, otp, purpose }) => {
  const purposeMap = {
    email_verify: "Email Verification",
    forgot_password: "Password Reset",
    login: "Login Verification",
  };

  const title = purposeMap[purpose] || "OTP Verification";

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
      .container { max-width: 500px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      .header { background: #6C63FF; padding: 30px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px; }
      .body { padding: 30px; text-align: center; }
      .otp-box { background: #f0eeff; border: 2px dashed #6C63FF; border-radius: 8px; padding: 20px; margin: 20px auto; display: inline-block; }
      .otp { font-size: 36px; font-weight: bold; color: #6C63FF; letter-spacing: 8px; }
      .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #999; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>EROVIANS</h1></div>
      <div class="body">
        <h2>${title}</h2>
        <p>Hi <strong>${name || "User"}</strong>,</p>
        <p>Use the OTP below to complete your ${title.toLowerCase()}. It expires in <strong>10 minutes</strong>.</p>
        <div class="otp-box">
          <div class="otp">${otp}</div>
        </div>
        <p style="color:#e74c3c; font-size:13px;">⚠️ Never share this OTP with anyone.</p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} Erovians. All rights reserved.</div>
    </div>
  </body>
  </html>
  `;
};