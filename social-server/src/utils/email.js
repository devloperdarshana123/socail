import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("Email send failed:", err.message);
    throw err;
  }
};

// OTP email template
export const sendOtpEmail = (to, otp) =>
  sendEmail({
    to,
    subject: "Erovians — Verify your email",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;">
        <h2>Email Verification</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing:8px;color:#4f46e5;">${otp}</h1>
        <p>Valid for <strong>10 minutes</strong>. Do not share this with anyone.</p>
      </div>
    `,
  });