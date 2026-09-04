import bcrypt from "bcryptjs";
import { otpRepository } from "../config/repositories.js";
import {
  generateSecureOtp,
  getOtpExpiry,
  isOtpExpired,
  getRemainingAttempts,
  OTP_CONFIG,
  isValidPurpose,
} from "./otpUtils.js";

// Persistence for the OTP domain now flows through the repository layer
// (Phase 7A) instead of the Prisma client directly. Database/behavior are
// unchanged — every query below is the same shape as the prisma.* call it
// replaces; only the access path moved.
//
// All OTP policy stays here: purpose validation, the resend cooldown and
// ceiling, expiry checks, the attempt budget, the constant-time dummy-hash
// compare for a missing OTP, and every returned message.
//
// IMPORTANT — why these use findByUserAndPurpose / findFirstWhere rather
// than OtpRepository.findActiveByUserAndPurpose(): that method filters BOTH
// `isUsed: false` AND `expiresAt > now`. This helper must be able to SEE an
// expired or used row — verifyOtp reports "OTP has expired" and deletes it,
// and getStatus reports `expired: true` — so substituting the "active"
// finder would silently turn those into "OTP not found". See the OTP
// characterization suite, which pins both messages.

const DUMMY_HASH = await bcrypt.hash("000000", 10);

export const canResend = async (userId, purpose) => {
  const otpDoc = await otpRepository.findByUserAndPurpose(userId, purpose);
  if (!otpDoc) return { canResend: true };

  if (otpDoc.lastResendAt) {
    const elapsed = Date.now() - otpDoc.lastResendAt.getTime();
    if (elapsed < OTP_CONFIG.RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_CONFIG.RESEND_COOLDOWN_MS - elapsed) / 1000);
      return { canResend: false, message: `Please wait ${waitSeconds} seconds before resending.`, waitSeconds };
    }
  }
  if (otpDoc.resendCount >= OTP_CONFIG.MAX_RESEND) {
    return { canResend: false, message: "Maximum resend limit reached. Please try again after 1 hour." };
  }
  return { canResend: true };
};

export const generateOtp = async (userId, purpose) => {
  if (!isValidPurpose(purpose)) {
    throw Object.assign(new Error(`Invalid OTP purpose: "${purpose}"`), { statusCode: 400 });
  }
  const check = await canResend(userId, purpose);
  if (!check.canResend) throw Object.assign(new Error(check.message), { statusCode: 429 });

  const otp = generateSecureOtp();
  const salt = await bcrypt.genSalt(OTP_CONFIG.SALT_ROUNDS);
  const hashedOtp = await bcrypt.hash(otp, salt);

  const otpDoc = await otpRepository.upsertByUserAndPurpose(userId, purpose, {
    update: {
      hashedOtp, attempts: 0, isUsed: false,
      expiresAt: getOtpExpiry(), lastResendAt: new Date(),
      resendCount: { inc: 1 },
    },
    create: {
      userId, purpose, hashedOtp, expiresAt: getOtpExpiry(),
      lastResendAt: new Date(), resendCount: 1,
    },
  });

  return { otp, otpDoc };
};

export const resendOtp = async (userId, purpose) => {
  if (!isValidPurpose(purpose)) {
    throw Object.assign(new Error(`Invalid OTP purpose: "${purpose}"`), { statusCode: 400 });
  }
  const check = await canResend(userId, purpose);
  if (!check.canResend) {
    throw Object.assign(new Error(check.message), { statusCode: 429, waitSeconds: check.waitSeconds });
  }

  const otp = generateSecureOtp();
  const salt = await bcrypt.genSalt(OTP_CONFIG.SALT_ROUNDS);
  const hashedOtp = await bcrypt.hash(otp, salt);

  const otpDoc = await otpRepository.upsertByUserAndPurpose(userId, purpose, {
    update: {
      hashedOtp, attempts: 0, isUsed: false,
      expiresAt: getOtpExpiry(), lastResendAt: new Date(),
      resendCount: { inc: 1 },
    },
    create: {
      userId, purpose, hashedOtp, expiresAt: getOtpExpiry(),
      lastResendAt: new Date(), resendCount: 1,
    },
  });

  return { otp, otpDoc };
};

export const verifyOtp = async (userId, purpose, plainOtp) => {
  if (!isValidPurpose(purpose)) {
    return { success: false, message: "Invalid OTP purpose" };
  }
  const trimmedOtp = String(plainOtp ?? "").trim();

  // NOTE: no expiry predicate here — see the header. An expired row must be
  // found so it can be reported as expired rather than as missing.
  const otpDoc = await otpRepository.findFirstWhere({ userId, purpose, isUsed: false });

  if (!otpDoc) {
    await bcrypt.compare(trimmedOtp, DUMMY_HASH);
    return { success: false, message: "OTP not found or already used. Please request a new one." };
  }

  if (isOtpExpired(otpDoc.expiresAt)) {
    await otpRepository.delete(otpDoc.id);
    return { success: false, message: `OTP has expired. Please request a new one. (Valid for ${OTP_CONFIG.EXPIRES_IN_LABEL})` };
  }

  if (otpDoc.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    await otpRepository.delete(otpDoc.id);
    return { success: false, message: "Too many failed attempts. Please request a new OTP.", remainingAttempts: 0 };
  }

  const isMatch = await bcrypt.compare(trimmedOtp, otpDoc.hashedOtp);

  if (!isMatch) {
    const updated = await otpRepository.update(otpDoc.id, { attempts: { inc: 1 } });
    const remaining = getRemainingAttempts(updated.attempts);

    if (remaining <= 0) {
      await otpRepository.delete(otpDoc.id);
      return { success: false, message: "Too many failed attempts. Please request a new OTP.", remainingAttempts: 0 };
    }
    return {
      success: false,
      message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      remainingAttempts: remaining,
    };
  }

  await otpRepository.delete(otpDoc.id);
  return { success: true, message: "OTP verified successfully", remainingAttempts: null };
};

export const getStatus = async (userId, purpose) => {
  const otpDoc = await otpRepository.findByUserAndPurpose(userId, purpose);
  if (!otpDoc) return { exists: false };

  const expired = isOtpExpired(otpDoc.expiresAt);
  const remainingAttempts = getRemainingAttempts(otpDoc.attempts);
  const canResendAt = otpDoc.lastResendAt
    ? new Date(otpDoc.lastResendAt.getTime() + OTP_CONFIG.RESEND_COOLDOWN_MS)
    : null;

  return {
    exists: true, expired, attemptsUsed: otpDoc.attempts,
    remainingAttempts, expiresAt: otpDoc.expiresAt,
    resendCount: otpDoc.resendCount, canResendAt,
  };
};

export const getRecentCount = (userId, windowMs = 3_600_000) =>
  otpRepository.count({ userId, createdAt: { gt: new Date(Date.now() - windowMs) } });

export const deleteAllForUser = async (userId) => {
  const result = await otpRepository.deleteManyWhere({ userId });
  return { deletedCount: result.count };
};