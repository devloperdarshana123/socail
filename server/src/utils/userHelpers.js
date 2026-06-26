import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { nanoid } from "nanoid";
import prisma from "../config/prisma.js";
import { ENV } from "../config/env.js";

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DEVICES = 10;
const COUNTABLE_FIELDS = new Set(["followersCount", "followingCount", "postsCount"]);

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Lookups ──────────────────────────────────────────
export const findByEmail = (email) =>
  prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

export const findByUsername = (username) =>
  prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } });

export const findByPhone = (phoneNumber) =>
  prisma.user.findUnique({ where: { phoneNumber } });

export const findByFirebaseUid = (firebaseUid) =>
  prisma.user.findUnique({ where: { firebaseUid } });

export const findById = (id) =>
  prisma.user.findUnique({ where: { id } });

// ── Password ─────────────────────────────────────────
export const hashPassword = async (plain) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
};

export const isPasswordCorrect = async (user, plainPassword) => {
  if (!user?.password) return false;
  return bcrypt.compare(plainPassword, user.password);
};

// ── Tokens ───────────────────────────────────────────
export const generateAccessToken = (user) =>
  jwt.sign(
    { _id: user.id, role: user.role, jti: nanoid(21) },
    ENV.USER_ACCESS_TOKEN_SECRET,
    { expiresIn: ENV.ACCESS_TOKEN_EXPIRY },
  );

export const generateAdminAccessToken = (user) =>
  jwt.sign(
    { _id: user.id, role: user.role, jti: nanoid(21) },
    ENV.ADMIN_ACCESS_TOKEN_SECRET,
    { expiresIn: ENV.ACCESS_TOKEN_EXPIRY },
  );

export const generateRefreshToken = async (
  user,
  deviceInfo = "unknown",
  ipAddress = null,
  rememberMe = false,
) => {
  const expiresIn = rememberMe ? "30d" : ENV.REFRESH_TOKEN_EXPIRY;
  const rawToken = jwt.sign({ _id: user.id }, ENV.USER_REFRESH_TOKEN_SECRET, { expiresIn });

  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiryMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : REFRESH_TOKEN_EXPIRY_MS;
  const expiresAt = new Date(now.getTime() + expiryMs);

  // Step 1 — expired tokens hatao
  await prisma.refreshToken.deleteMany({
    where: { userId: user.id, expiresAt: { lte: now } },
  });

  // Step 2 — naya token banao
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, deviceInfo, ipAddress, expiresAt, lastUsedAt: now },
  });

  // Step 3 — device limit (MAX_DEVICES) — purane extra tokens hatao
  const allTokens = await prisma.refreshToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (allTokens.length > MAX_DEVICES) {
    const toDelete = allTokens.slice(0, allTokens.length - MAX_DEVICES);
    await prisma.refreshToken.deleteMany({
      where: { id: { in: toDelete.map((t) => t.id) } },
    });
  }

  return rawToken;
};

export const generateAdminRefreshToken = async (user, deviceInfo = "unknown", ipAddress = null) => {
  const rawToken = jwt.sign({ _id: user.id }, ENV.ADMIN_REFRESH_TOKEN_SECRET, {
    expiresIn: ENV.REFRESH_TOKEN_EXPIRY,
  });
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lte: now } } });
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, deviceInfo, ipAddress, expiresAt, lastUsedAt: now },
  });

  return rawToken;
};

export const findByRefreshToken = async (rawToken) => {
  const tokenHash = hashToken(rawToken);
  const tokenRow = await prisma.refreshToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  return tokenRow ? { ...tokenRow.user, _matchedTokenRow: tokenRow } : null;
};

export const touchRefreshToken = (rawToken) => {
  const tokenHash = hashToken(rawToken);
  return prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { lastUsedAt: new Date() },
  });
};

export const removeRefreshToken = (userId, rawToken) => {
  const tokenHash = hashToken(rawToken);
  return prisma.refreshToken.deleteMany({ where: { userId, tokenHash } });
};

export const removeAllRefreshTokens = (userId) =>
  prisma.refreshToken.deleteMany({ where: { userId } });

export const removeOtherRefreshTokens = (userId, currentRawToken) => {
  if (!currentRawToken) return removeAllRefreshTokens(userId);
  const currentHash = hashToken(currentRawToken);
  return prisma.refreshToken.deleteMany({
    where: { userId, tokenHash: { not: currentHash } },
  });
};

export const getRefreshTokenByHash = (userId, rawToken) => {
  const tokenHash = hashToken(rawToken);
  return prisma.refreshToken.findFirst({ where: { userId, tokenHash } });
};

export const consumeRefreshTokenByHash = async (userId, rawToken) => {
  const tokenHash = hashToken(rawToken);
  const result = await prisma.refreshToken.deleteMany({ where: { userId, tokenHash } });
  return result.count > 0;
};

// ── Safe Object ──────────────────────────────────────
export const toSafeObject = (user) => ({
  _id: user.id,
  username: user.username,
  fullName: user.fullName,
  email: user.email || null,
  phoneNumber: user.phoneNumber || null,
  avatar: user.avatar || null,
  avatarUrl: user.avatar?.url || null,
  coverPhoto: user.coverPhoto || null,
  bio: user.bio,
  designation: user.designation || "",
  website: user.website,
  gender: user.gender,
  dateOfBirth: user.dateOfBirth,
  isEmailVerified: user.isEmailVerified,
  isMobileVerified: user.isMobileVerified,
  isPrivate: user.isPrivate,
  isVerifiedBadge: user.isVerifiedBadge,
  accountStatus: user.accountStatus,
  isOnboardingComplete: user.isOnboardingComplete,
  onboardingStep: user.onboardingStep,
  role: user.role,
  authProvider: user.authProvider,
  hasPassword: !!user.password,
  followersCount: user.followersCount,
  followingCount: user.followingCount,
  postsCount: user.postsCount,
  notificationsEnabled: user.notificationsEnabled,
  language: user.language,
  businessCategory: user.businessCategory || null,
  location: user.location || null,
  createdAt: user.createdAt,
});

// ── Search / counts ──────────────────────────────────
export const searchUsers = async (query, limit = 20) => {
  const q = query?.trim();
  if (!q || q.length < 2) return [];
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

  return prisma.user.findMany({
    where: {
      accountStatus: "active",
      role: { not: "super_admin" },
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
      ],
    },
    take: safeLimit,
    select: {
      id: true, username: true, fullName: true, avatar: true,
      isVerifiedBadge: true, isPrivate: true, followersCount: true,
    },
  });
};

export const updateCount = (userId, field, value) => {
  if (!COUNTABLE_FIELDS.has(field)) {
    throw new Error(`Invalid count field: "${field}"`);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("updateCount: value must be a finite number");
  }
  return prisma.user.update({
    where: { id: userId },
    data: { [field]: { increment: value } },
  });
};