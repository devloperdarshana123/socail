import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  generateSecureOtp,
  getOtpExpiry,
  isOtpExpired,
  getRemainingAttempts,
  OTP_CONFIG,
  OTP_PURPOSE,
  isValidPurpose,
} from "../utils/otpUtils.js";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  OTP Schema
//  TTL index → MongoDB auto-delete after expiresAt
// ─────────────────────────────────────────────

const otpSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    purpose: {
      type: String,
      enum: Object.values(OTP_PURPOSE), // from otp.utils.js
      required: true,
    },

    hashedOtp: {
      type: String,
      required: true,
      select: false, // never return in queries by default
    },

    attempts: {
      type: Number,
      default: 0,
      max: [OTP_CONFIG.MAX_ATTEMPTS, "Too many incorrect attempts"],
    },

    resendCount: {
      type: Number,
      default: 0,
    },

    lastResendAt: {
      type: Date,
      default: null,
    },

    isUsed: {
      type: Boolean,
      default: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      default: getOtpExpiry, // from otp.utils.js
    },
  },
  {
    timestamps: true,
  },
);

// ─── TTL Index — MongoDB auto-delete after expiresAt ───
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Compound index: one active OTP per user per purpose ───
otpSchema.index({ userId: 1, purpose: 1 });

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Generate and store a new OTP for a user
 *
 * @param {ObjectId} userId
 * @param {string} purpose  — from OTP_PURPOSE
 * @returns {{ otp: string, otpDoc: Document }}
 *
 * - Uses generateSecureOtp() from otp.utils.js (crypto-based, not Math.random)
 * - Deletes any existing OTP for same user + purpose before creating new
 * - expiresAt from getOtpExpiry() — OTP_CONFIG.EXPIRES_IN_MS (10 min)
 */
otpSchema.statics.generateOtp = async function (userId, purpose) {
  if (!isValidPurpose(purpose)) {
    throw new Error(
      `Invalid OTP purpose: "${purpose}". Valid: ${Object.values(OTP_PURPOSE).join(", ")}`,
    );
  }

  // Delete any existing OTP for same user + purpose
  await this.deleteMany({ userId, purpose });

  // Secure OTP from otp.utils.js
  const otp = generateSecureOtp();

  const salt = await bcrypt.genSalt(OTP_CONFIG.SALT_ROUNDS);
  const hashedOtp = await bcrypt.hash(otp, salt);

  const otpDoc = await this.create({
    userId,
    purpose,
    hashedOtp,
    expiresAt: getOtpExpiry(), // OTP_CONFIG.EXPIRES_IN_MS from utils
  });

  // Return plain OTP once — caller must send via email/SMS immediately
  // Never stored in plain — only hashedOtp is in DB
  return { otp, otpDoc };
};

/**
 * Verify OTP
 * - Increments attempts on wrong OTP
 * - Deletes doc on success OR max attempts exceeded OR expired
 *
 * @param {ObjectId} userId
 * @param {string} purpose
 * @param {string} plainOtp
 * @returns {{ success: boolean, message: string, remainingAttempts?: number }}
 */
otpSchema.statics.verifyOtp = async function (userId, purpose, plainOtp) {
  if (!isValidPurpose(purpose)) {
    return { success: false, message: "Invalid OTP purpose" };
  }

  const otpDoc = await this.findOne({
    userId,
    purpose,
    isUsed: false,
  }).select("+hashedOtp");

  // Not found or already used
  if (!otpDoc) {
    return {
      success: false,
      message: "OTP not found or already used. Please request a new one.",
    };
  }

  // Expired check — isOtpExpired from otp.utils.js
  if (isOtpExpired(otpDoc.expiresAt)) {
    await otpDoc.deleteOne();
    return {
      success: false,
      message: `OTP has expired. Please request a new one. (Valid for ${OTP_CONFIG.EXPIRES_IN_LABEL})`,
    };
  }

  // Max attempts exceeded — OTP_CONFIG.MAX_ATTEMPTS from utils
  if (otpDoc.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    await otpDoc.deleteOne();
    return {
      success: false,
      message: "Too many failed attempts. Please request a new OTP.",
    };
  }

  const isMatch = await bcrypt.compare(plainOtp, otpDoc.hashedOtp);

  if (!isMatch) {
    otpDoc.attempts += 1;
    await otpDoc.save();

    const remaining = getRemainingAttempts(otpDoc.attempts); // from otp.utils.js

    // Auto-delete if this was the last attempt
    if (remaining === 0) {
      await otpDoc.deleteOne();
      return {
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
        remainingAttempts: 0,
      };
    }

    return {
      success: false,
      message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      remainingAttempts: remaining,
    };
  }

  // ✅ Correct OTP — delete document
  await otpDoc.deleteOne();

  return {
    success: true,
    message: "OTP verified successfully",
    remainingAttempts: null,
  };
};

/**
 * Check resend eligibility
 *
 * @param {ObjectId} userId
 * @param {string} purpose
 * @returns {{ canResend: boolean, message?: string, waitSeconds?: number }}
 */
otpSchema.statics.canResend = async function (userId, purpose) {
  const otpDoc = await this.findOne({ userId, purpose });

  if (!otpDoc) return { canResend: true };

  // Cooldown check — RESEND_COOLDOWN_MS from otp.utils.js
  if (otpDoc.lastResendAt) {
    const elapsed = Date.now() - otpDoc.lastResendAt.getTime();
    if (elapsed < OTP_CONFIG.RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (OTP_CONFIG.RESEND_COOLDOWN_MS - elapsed) / 1000,
      );
      return {
        canResend: false,
        message: `Please wait ${waitSeconds} seconds before resending.`,
        waitSeconds,
      };
    }
  }

  // Max resend check — MAX_RESEND from otp.utils.js
  if (otpDoc.resendCount >= OTP_CONFIG.MAX_RESEND) {
    return {
      canResend: false,
      message: "Maximum resend limit reached. Please try again after 1 hour.",
    };
  }

  return { canResend: true };
};

/**
 * Resend OTP — generates fresh OTP, tracks resendCount + lastResendAt
 *
 * @param {ObjectId} userId
 * @param {string} purpose
 * @returns {{ otp: string, otpDoc: Document }}
 */
otpSchema.statics.resendOtp = async function (userId, purpose) {
  if (!isValidPurpose(purpose)) {
    throw new Error(`Invalid OTP purpose: "${purpose}"`);
  }

  // Get old doc to preserve resendCount
  const existing = await this.findOne({ userId, purpose });
  const resendCount = existing ? existing.resendCount + 1 : 1;

  // Delete old
  await this.deleteMany({ userId, purpose });

  // Fresh secure OTP
  const otp = generateSecureOtp();
  const salt = await bcrypt.genSalt(OTP_CONFIG.SALT_ROUNDS);
  const hashedOtp = await bcrypt.hash(otp, salt);

  const otpDoc = await this.create({
    userId,
    purpose,
    hashedOtp,
    expiresAt: getOtpExpiry(),
    resendCount,
    lastResendAt: new Date(),
  });

  return { otp, otpDoc };
};

/**
 * Delete all OTPs for a user (account deletion, admin action)
 */
otpSchema.statics.deleteAllForUser = async function (userId) {
  return this.deleteMany({ userId });
};

const OTP = models.OTP || model("OTP", otpSchema);
export default OTP;
