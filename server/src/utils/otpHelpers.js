import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import {
  generateSecureOtp,
  getOtpExpiry,
  isOtpExpired,
  getRemainingAttempts,
  OTP_CONFIG,
  isValidPurpose,
} from "./otpUtils.js";

const DUMMY_HASH = await bcrypt.hash("000000", 10);

export const canResend = async (userId, purpose) => {
  const otpDoc = await prisma.oTP.findUnique({ where: { userId_purpose: { userId, purpose } } });
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

  const otpDoc = await prisma.oTP.upsert({
    where: { userId_purpose: { userId, purpose } },
    update: {
      hashedOtp, attempts: 0, isUsed: false,
      expiresAt: getOtpExpiry(), lastResendAt: new Date(),
      resendCount: { increment: 1 },
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

  const otpDoc = await prisma.oTP.upsert({
    where: { userId_purpose: { userId, purpose } },
    update: {
      hashedOtp, attempts: 0, isUsed: false,
      expiresAt: getOtpExpiry(), lastResendAt: new Date(),
      resendCount: { increment: 1 },
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

  const otpDoc = await prisma.oTP.findFirst({ where: { userId, purpose, isUsed: false } });

  if (!otpDoc) {
    await bcrypt.compare(trimmedOtp, DUMMY_HASH);
    return { success: false, message: "OTP not found or already used. Please request a new one." };
  }

  if (isOtpExpired(otpDoc.expiresAt)) {
    await prisma.oTP.delete({ where: { id: otpDoc.id } });
    return { success: false, message: `OTP has expired. Please request a new one. (Valid for ${OTP_CONFIG.EXPIRES_IN_LABEL})` };
  }

  if (otpDoc.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    await prisma.oTP.delete({ where: { id: otpDoc.id } });
    return { success: false, message: "Too many failed attempts. Please request a new OTP.", remainingAttempts: 0 };
  }

  const isMatch = await bcrypt.compare(trimmedOtp, otpDoc.hashedOtp);

  if (!isMatch) {
    const updated = await prisma.oTP.update({
      where: { id: otpDoc.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = getRemainingAttempts(updated.attempts);

    if (remaining <= 0) {
      await prisma.oTP.delete({ where: { id: otpDoc.id } });
      return { success: false, message: "Too many failed attempts. Please request a new OTP.", remainingAttempts: 0 };
    }
    return {
      success: false,
      message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      remainingAttempts: remaining,
    };
  }

  await prisma.oTP.delete({ where: { id: otpDoc.id } });
  return { success: true, message: "OTP verified successfully", remainingAttempts: null };
};

export const getStatus = async (userId, purpose) => {
  const otpDoc = await prisma.oTP.findUnique({ where: { userId_purpose: { userId, purpose } } });
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
  prisma.oTP.count({ where: { userId, createdAt: { gt: new Date(Date.now() - windowMs) } } });

export const deleteAllForUser = async (userId) => {
  const result = await prisma.oTP.deleteMany({ where: { userId } });
  return { deletedCount: result.count };
};