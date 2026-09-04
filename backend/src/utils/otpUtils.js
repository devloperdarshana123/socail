import crypto from "crypto";

// ─────────────────────────────────────────────
//  OTP Constants
// ─────────────────────────────────────────────

export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRES_IN_MS: 10 * 60 * 1000, // 10 minutes
  EXPIRES_IN_LABEL: "10 minutes",
  MAX_ATTEMPTS: 5,
  MAX_RESEND: 3, // max resend per hour
  RESEND_COOLDOWN_MS: 60 * 1000, // 1 minute between resends
  SALT_ROUNDS: 10,
};

export const OTP_PURPOSE = {
  EMAIL_VERIFY: "email_verify",
  MOBILE_VERIFY: "mobile_verify",
  FORGOT_PASSWORD: "forgot_password",
  LOGIN: "login",
};

// ─────────────────────────────────────────────
//  Generate cryptographically secure 6-digit OTP
//  Uses crypto.randomBytes — NOT Math.random()
// ─────────────────────────────────────────────

export const generateSecureOtp = () => {
  // 3 bytes = 24 bits → range 0 to 16,777,215
  // modulo 900000 → range 0–899999, + 100000 → 100000–999999
  const buffer = crypto.randomBytes(3);
  const otp = (buffer.readUIntBE(0, 3) % 900000) + 100000;
  return otp.toString();
};

// ─────────────────────────────────────────────
//  Get OTP expiry Date object
// ─────────────────────────────────────────────

export const getOtpExpiry = () =>
  new Date(Date.now() + OTP_CONFIG.EXPIRES_IN_MS);

// ─────────────────────────────────────────────
//  Check if OTP is expired
// ─────────────────────────────────────────────

export const isOtpExpired = (expiresAt) => expiresAt < new Date();

// ─────────────────────────────────────────────
//  Remaining attempts helper
// ─────────────────────────────────────────────

export const getRemainingAttempts = (attempts) =>
  Math.max(0, OTP_CONFIG.MAX_ATTEMPTS - attempts);

// ─────────────────────────────────────────────
//  Purpose → human readable label
// ─────────────────────────────────────────────

export const getPurposeLabel = (purpose) => {
  const map = {
    [OTP_PURPOSE.EMAIL_VERIFY]: "email verification",
    [OTP_PURPOSE.MOBILE_VERIFY]: "mobile verification",
    [OTP_PURPOSE.FORGOT_PASSWORD]: "password reset",
    [OTP_PURPOSE.LOGIN]: "login",
  };
  return map[purpose] || purpose;
};

// ─────────────────────────────────────────────
//  Validate purpose string
// ─────────────────────────────────────────────

export const isValidPurpose = (purpose) =>
  Object.values(OTP_PURPOSE).includes(purpose);
