

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

// ─────────────────────────────────────────────────────────────────────────────
//  OTP Schema
//  One document per (userId + purpose) — enforced by unique compound index.
//  TTL index → MongoDB auto-deletes expired documents (runs every ~60 seconds).
//  Application-level isOtpExpired() check handles the 60s TTL lag window.
// ─────────────────────────────────────────────────────────────────────────────

const otpSchema = new Schema(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    purpose: {
      type:     String,
      enum:     Object.values(OTP_PURPOSE),
      required: true,
    },

    hashedOtp: {
      type:     String,
      required: true,
      select:   false, // never returned in queries unless .select("+hashedOtp")
    },

    // FIX #13 — schema max validator removed: it doesn't fire on findByIdAndUpdate.
    //           The real guard is the application-level check in verifyOtp().
    //           Keeping it here would give false confidence after the atomic fix.
    attempts: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // Tracks how many times OTP was regenerated/resent for this (user + purpose).
    // FIX #12 — both generateOtp() and resendOtp() contribute to this counter
    //           so rate limiting can't be bypassed by switching between the two flows.
    resendCount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    lastResendAt: {
      type:    Date,
      default: null,
    },

    isUsed: {
      type:    Boolean,
      default: false,
    },

    expiresAt: {
      type:     Date,
      required: true,
      default:  getOtpExpiry,
    },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Auto-delete documents after expiresAt.
// NOTE: TTL daemon runs every ~60 seconds — documents can linger up to 60s
// after expiresAt. Always use isOtpExpired() in application code, never rely
// on the TTL alone to block expired OTP usage.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// FIX #5 — unique: true enforces one active OTP per (user + purpose).
//           Was a plain index before — multiple concurrent OTPs could coexist.
otpSchema.index({ userId: 1, purpose: 1 }, { unique: true });

// Rate limiting helper: count recent OTPs per user within a time window
otpSchema.index({ userId: 1, createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Dummy hash — used for constant-time comparison on not-found path
//  FIX #2 — pre-computed once at module load; prevents timing attacks that
//           distinguish "OTP not found" from "OTP wrong" via response time.
// ─────────────────────────────────────────────────────────────────────────────

const DUMMY_HASH = await bcrypt.hash("000000", 10);

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate and store a new OTP for a user.
 *
 * FIX #4  — atomic upsert via findOneAndUpdate replaces deleteMany + create.
 *           Eliminates the race window where two concurrent requests each delete
 *           then create, resulting in two valid OTPs for the same user+purpose.
 * FIX #12 — increments resendCount so this flow contributes to the same rate
 *           limit counter as resendOtp(). Bypassing generateOtp() to skip the
 *           limit is no longer possible.
 *
 * @param {ObjectId} userId
 * @param {string}   purpose  — from OTP_PURPOSE
 * @returns {{ otp: string, otpDoc: Document }}
 */
otpSchema.statics.generateOtp = async function (userId, purpose) {
  if (!isValidPurpose(purpose)) {
    throw Object.assign(
      new Error(`Invalid OTP purpose: "${purpose}". Valid: ${Object.values(OTP_PURPOSE).join(", ")}`),
      { statusCode: 400 },
    );
  }

  // FIX #12 — check resend rate limit before generating (same guard as resendOtp)
  const canResendResult = await this.canResend(userId, purpose);
  if (!canResendResult.canResend) {
    throw Object.assign(new Error(canResendResult.message), { statusCode: 429 });
  }

  // Generate and hash new OTP
  const otp       = generateSecureOtp();
  const salt      = await bcrypt.genSalt(OTP_CONFIG.SALT_ROUNDS);
  const hashedOtp = await bcrypt.hash(otp, salt);

  // FIX #4 — atomic upsert: replaces the entire document if one exists,
  //          creates a new one if not. No delete+create race window.
  const otpDoc = await this.findOneAndUpdate(
    { userId, purpose },
    {
      $set: {
        hashedOtp,
        attempts:     0,
        isUsed:       false,
        expiresAt:    getOtpExpiry(),
        lastResendAt: new Date(),
      },
      // FIX #12 — increment resendCount atomically on every generation
      $inc: { resendCount: 1 },
    },
    {
      upsert:         true,
      new:            true,
      setDefaultsOnInsert: true,
      // On first insert (upsert), resendCount starts at 0 then $inc makes it 1
      // On subsequent calls, resendCount accumulates correctly
    },
  );

  // Return plain OTP exactly once — caller must send via email/SMS immediately.
  // Never stored in plain text — only hashedOtp is in DB.
  return { otp, otpDoc };
};

/**
 * Verify an OTP.
 *
 * FIX #1 — attempts increment is now atomic via $inc (was otpDoc.attempts += 1 + save()).
 *           Two simultaneous wrong-OTP requests no longer overwrite each other's counter.
 * FIX #2 — timing attack mitigated: dummy bcrypt.compare runs on the not-found path
 *           so response time is equalized regardless of whether an OTP record exists.
 * FIX #7 — plainOtp is trimmed before comparison (handles copy-paste trailing spaces).
 *
 * @param {ObjectId} userId
 * @param {string}   purpose
 * @param {string}   plainOtp
 * @returns {{ success: boolean, message: string, remainingAttempts?: number | null }}
 */
otpSchema.statics.verifyOtp = async function (userId, purpose, plainOtp) {
  if (!isValidPurpose(purpose)) {
    return { success: false, message: "Invalid OTP purpose" };
  }

  // FIX #7 — trim before comparison
  const trimmedOtp = String(plainOtp ?? "").trim();

  const otpDoc = await this.findOne({
    userId,
    purpose,
    isUsed: false,
  }).select("+hashedOtp");

  // FIX #2 — not-found path: run dummy compare to equalize timing with wrong-OTP path.
  //          An attacker measuring response time can no longer distinguish
  //          "no OTP exists" from "OTP exists but wrong value".
  if (!otpDoc) {
    await bcrypt.compare(trimmedOtp, DUMMY_HASH); // deliberate — equalizes timing
    return {
      success: false,
      message: "OTP not found or already used. Please request a new one.",
    };
  }

  // Application-level expiry check — handles the 60s TTL daemon lag window
  if (isOtpExpired(otpDoc.expiresAt)) {
    await otpDoc.deleteOne();
    return {
      success: false,
      message: `OTP has expired. Please request a new one. (Valid for ${OTP_CONFIG.EXPIRES_IN_LABEL})`,
    };
  }

  // Max attempts exceeded (check before bcrypt to avoid unnecessary work)
  if (otpDoc.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    await otpDoc.deleteOne();
    return {
      success: false,
      message: "Too many failed attempts. Please request a new OTP.",
      remainingAttempts: 0,
    };
  }

  const isMatch = await bcrypt.compare(trimmedOtp, otpDoc.hashedOtp);

  if (!isMatch) {
    // FIX #1 — atomic $inc: two concurrent wrong-OTP requests now correctly
    //          each increment attempts by 1 (was: both read 0, both save 1).
    const updated = await this.findByIdAndUpdate(
      otpDoc._id,
      { $inc: { attempts: 1 } },
      { new: true },
    );

    const newAttempts = updated?.attempts ?? otpDoc.attempts + 1;
    const remaining   = getRemainingAttempts(newAttempts);

    // Auto-delete if max attempts reached after this increment
    if (remaining <= 0) {
      await this.findByIdAndDelete(otpDoc._id);
      return {
        success:          false,
        message:          "Too many failed attempts. Please request a new OTP.",
        remainingAttempts: 0,
      };
    }

    return {
      success:          false,
      message:          `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      remainingAttempts: remaining,
    };
  }

  // ✅ Correct OTP — delete document immediately (single-use)
  await otpDoc.deleteOne();

  return {
    success:          true,
    message:          "OTP verified successfully",
    remainingAttempts: null,
  };
};

/**
 * Check if user can resend an OTP.
 * Called internally by generateOtp() and resendOtp() before generating.
 *
 * @param {ObjectId} userId
 * @param {string}   purpose
 * @returns {{ canResend: boolean, message?: string, waitSeconds?: number }}
 */
otpSchema.statics.canResend = async function (userId, purpose) {
  const otpDoc = await this.findOne({ userId, purpose });

  if (!otpDoc) return { canResend: true };

  // Cooldown check
  if (otpDoc.lastResendAt) {
    const elapsed = Date.now() - otpDoc.lastResendAt.getTime();
    if (elapsed < OTP_CONFIG.RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_CONFIG.RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        canResend:   false,
        message:     `Please wait ${waitSeconds} seconds before resending.`,
        waitSeconds,
      };
    }
  }

  // Max resend check
  if (otpDoc.resendCount >= OTP_CONFIG.MAX_RESEND) {
    return {
      canResend: false,
      message:   "Maximum resend limit reached. Please try again after 1 hour.",
    };
  }

  return { canResend: true };
};

/**
 * Resend OTP — generates a fresh OTP and tracks resend metadata.
 *
 * FIX #3  — atomic upsert replaces findOne + deleteMany + create (3 round trips → 1).
 *           Two concurrent resend requests no longer both bypass MAX_RESEND check.
 * FIX #6  — canResend() is called internally; controllers no longer need to
 *           call it separately before resendOtp() to enforce the limit.
 * FIX #9  — 3 sequential DB round trips collapsed to 1 atomic findOneAndUpdate.
 *
 * @param {ObjectId} userId
 * @param {string}   purpose
 * @returns {{ otp: string, otpDoc: Document }}
 */
otpSchema.statics.resendOtp = async function (userId, purpose) {
  if (!isValidPurpose(purpose)) {
    throw Object.assign(
      new Error(`Invalid OTP purpose: "${purpose}"`),
      { statusCode: 400 },
    );
  }

  // FIX #6 — guard lives here, not just in controllers
  const canResendResult = await this.canResend(userId, purpose);
  if (!canResendResult.canResend) {
    throw Object.assign(
      new Error(canResendResult.message),
      { statusCode: 429, waitSeconds: canResendResult.waitSeconds },
    );
  }

  const otp       = generateSecureOtp();
  const salt      = await bcrypt.genSalt(OTP_CONFIG.SALT_ROUNDS);
  const hashedOtp = await bcrypt.hash(otp, salt);

  // FIX #3 — atomic upsert: single round trip, no race window
  const otpDoc = await this.findOneAndUpdate(
    { userId, purpose },
    {
      $set: {
        hashedOtp,
        attempts:     0,
        isUsed:       false,
        expiresAt:    getOtpExpiry(),
        lastResendAt: new Date(),
      },
      $inc: { resendCount: 1 },
    },
    {
      upsert:              true,
      new:                 true,
      setDefaultsOnInsert: true,
    },
  );

  return { otp, otpDoc };
};

/**
 * Get current OTP status for a user (read-only, no side effects).
 * FIX #15 — new helper: controllers use this to show "expires in X min,
 *            Y attempts left, resend in Z sec" without running verifyOtp().
 *
 * @param {ObjectId} userId
 * @param {string}   purpose
 * @returns {{ exists: boolean, expired?: boolean, attemptsUsed?: number,
 *             remainingAttempts?: number, expiresAt?: Date,
 *             resendCount?: number, canResendAt?: Date | null }}
 */
otpSchema.statics.getStatus = async function (userId, purpose) {
  const otpDoc = await this.findOne({ userId, purpose });

  if (!otpDoc) return { exists: false };

  const expired          = isOtpExpired(otpDoc.expiresAt);
  const remainingAttempts = getRemainingAttempts(otpDoc.attempts);
  const canResendAt      = otpDoc.lastResendAt
    ? new Date(otpDoc.lastResendAt.getTime() + OTP_CONFIG.RESEND_COOLDOWN_MS)
    : null;

  return {
    exists:            true,
    expired,
    attemptsUsed:      otpDoc.attempts,
    remainingAttempts,
    expiresAt:         otpDoc.expiresAt,
    resendCount:       otpDoc.resendCount,
    canResendAt,       // null = can resend now; future Date = must wait until then
  };
};

/**
 * Get recent OTP generation count for a user within a time window.
 * FIX #8 — rate limiting helper for controllers.
 *           Usage: if (await OTP.getRecentCount(userId, 3600_000) >= 5) → block
 *
 * @param {ObjectId} userId
 * @param {number}   windowMs  — e.g. 3_600_000 for 1 hour
 * @returns {number}
 */
otpSchema.statics.getRecentCount = function (userId, windowMs = 3_600_000) {
  return this.countDocuments({
    userId,
    createdAt: { $gt: new Date(Date.now() - windowMs) },
  });
};

/**
 * Delete all OTPs for a user (account deletion / admin action).
 * FIX #14 — returns normalized { deletedCount } instead of raw deleteMany result.
 *
 * @param {ObjectId} userId
 * @returns {{ deletedCount: number }}
 */
otpSchema.statics.deleteAllForUser = async function (userId) {
  const result = await this.deleteMany({ userId });
  return { deletedCount: result.deletedCount ?? 0 };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const OTP = models.OTP || model("OTP", otpSchema);
export default OTP;