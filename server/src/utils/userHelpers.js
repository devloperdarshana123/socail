import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { nanoid } from "nanoid";
import {
  userRepository,
  sessionRepository,
  followRepository,
  blockRepository,
} from "../config/repositories.js";
import { ENV } from "../config/env.js";

// Persistence for the user domain now flows through the repository layer
// (Phase 7A) instead of the Prisma client directly. Database/behavior are
// unchanged — every query below is the same shape as the prisma.* call it
// replaces; only the access path moved.
//
// ── Prisma.JsonNull IS NO LONGER IMPORTED HERE ──────────────────────────
// findMapSellers previously imported the Prisma namespace purely to build
// its "has a location" predicate. That sentinel now lives inside
// UserRepository.findUsersWithLocation(), which expresses the same intent as
// a domain contract; the sentinel itself is injected into the repository by
// config/repositories.js (the only layer allowed to know about Prisma).
// This helper passes plain conditions and is completely Prisma-free.
//
// ── NO NETWORK HERE ─────────────────────────────────────────────────────
// This helper performs NO geocoding and no Cloudinary/Redis work. Nominatim
// geocoding lives in the controller's orchestration (unchanged since
// Milestone 5F) — that boundary is deliberately preserved, so every method
// below is pure persistence plus local crypto/JWT.
//
// AUTHENTICATION REMAINS FROZEN (Milestone 5I): token generation, hashing,
// expiry windows and the MAX_DEVICES eviction policy are byte-identical;
// only the persistence calls underneath them moved.

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DEVICES = 10;
const COUNTABLE_FIELDS = new Set(["followersCount", "followingCount", "postsCount"]);

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Lookups ──────────────────────────────────────────
export const findByEmail = (email) =>
  userRepository.findByEmail(email.toLowerCase().trim());

export const findByUsername = (username) =>
  userRepository.findByUsername(username.toLowerCase().trim());

export const findByPhone = (phoneNumber) =>
  userRepository.findByPhoneNumber(phoneNumber);

export const findByFirebaseUid = (firebaseUid) =>
  userRepository.findByFirebaseUid(firebaseUid);

export const findById = (id) =>
  userRepository.findById(id);

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
  await sessionRepository.deleteManyWhere({ userId: user.id, expiresAt: { lte: now } });

  // Step 2 — naya token banao
  await sessionRepository.create({
    userId: user.id, tokenHash, deviceInfo, ipAddress, expiresAt, lastUsedAt: now,
  });

  // Step 3 — device limit (MAX_DEVICES) — purane extra tokens hatao
  const allTokens = await sessionRepository.findAllByUserIdOldestFirst(user.id);
  if (allTokens.length > MAX_DEVICES) {
    const toDelete = allTokens.slice(0, allTokens.length - MAX_DEVICES);
    await sessionRepository.deleteManyWhere({ id: { in: toDelete.map((t) => t.id) } });
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

  await sessionRepository.deleteManyWhere({ userId: user.id, expiresAt: { lte: now } });
  await sessionRepository.create({
    userId: user.id, tokenHash, deviceInfo, ipAddress, expiresAt, lastUsedAt: now,
  });

  return rawToken;
};

export const findByRefreshToken = async (rawToken) => {
  const tokenHash = hashToken(rawToken);
  const tokenRow = await sessionRepository.findFirstWhere(
    { tokenHash, expiresAt: { gt: new Date() } },
    { include: { user: true } }
  );
  return tokenRow ? { ...tokenRow.user, _matchedTokenRow: tokenRow } : null;
};

export const touchRefreshToken = (rawToken) => {
  const tokenHash = hashToken(rawToken);
  return sessionRepository.updateManyWhere({ tokenHash }, { lastUsedAt: new Date() });
};

export const removeRefreshToken = (userId, rawToken) => {
  const tokenHash = hashToken(rawToken);
  return sessionRepository.deleteManyWhere({ userId, tokenHash });
};

export const removeAllRefreshTokens = (userId) =>
  sessionRepository.deleteManyByUserId(userId);

export const removeOtherRefreshTokens = (userId, currentRawToken) => {
  if (!currentRawToken) return removeAllRefreshTokens(userId);
  const currentHash = hashToken(currentRawToken);
  return sessionRepository.deleteManyWhere({ userId, tokenHash: { not: currentHash } });
};

export const getRefreshTokenByHash = (userId, rawToken) => {
  const tokenHash = hashToken(rawToken);
  return sessionRepository.findFirstWhere({ userId, tokenHash });
};

export const consumeRefreshTokenByHash = async (userId, rawToken) => {
  const tokenHash = hashToken(rawToken);
  const result = await sessionRepository.deleteManyWhere({ userId, tokenHash });
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

  return userRepository.searchActiveUsers(q, {
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
  return userRepository.update(userId, { [field]: { inc: value } });
};

// ── Controller-extracted queries (Milestone 5F) ─────────────────────────
//    Every query below was inline in user.controller.js and is moved here
//    verbatim so the controller performs no direct DB access. Queries are
//    byte-identical to the ones they replace. These are all persistence
//    only — no Cloudinary, no Nominatim geocoding, no Redis (those stay in
//    the controller's orchestration).

// updateAvatar / removeAvatar: write the avatar value (object or nulls).
export const updateUserAvatar = (userId, avatar) => {
  return userRepository.update(userId, { avatar });
};

// updateCoverPhoto / removeCoverPhoto: write the cover-photo value.
export const updateUserCoverPhoto = (userId, coverPhoto) => {
  return userRepository.update(userId, { coverPhoto });
};

// updateProfile: write the assembled profile update fields.
export const updateUserProfileFields = (userId, data) => {
  return userRepository.update(userId, data);
};

// getMapSellers: active, non-admin sellers that have a location, optionally
// filtered by category and a free-text query. The "has a location" predicate
// (previously built here with the Prisma.JsonNull sentinel) now lives inside
// UserRepository.findUsersWithLocation — see this file's header. Only plain
// conditions are assembled here. The controller keeps the q length-validation
// (400 response) and the follow-status / caching orchestration.
export const findMapSellers = ({ q, category } = {}) => {
  const baseConditions = [
    { accountStatus: "active" },
    { role: { not: "super_admin" } },
  ];
  if (category && category !== "all") baseConditions.push({ businessCategory: category });

  if (q) {
    baseConditions.push({
      or: [
        { fullName:         { like: q, caseInsensitive: true } },
        { designation:      { like: q, caseInsensitive: true } },
        { businessCategory: { like: q, caseInsensitive: true } },
      ],
    });
  }

  return userRepository.findUsersWithLocation(baseConditions, {
    select: {
      id: true, fullName: true, username: true, avatar: true, designation: true,
      businessCategory: true, location: true, followersCount: true,
      isVerifiedBadge: true, isPrivate: true,
    },
    take: 200,
  });
};

// getMapSellers: the current user's accepted following ids (for isFollowing).
export const getAcceptedFollowingIds = (currentUserId) => {
  return followRepository.findAllFollowingIds(currentUserId, { status: "accepted" });
};

// blockUser: idempotent block.
export const upsertBlock = (blockerId, blockedId) => {
  return blockRepository.upsertByBlockerAndBlocked(blockerId, blockedId, {
    update: {},
    create: { blockerId, blockedId },
  });
};

// unblockUser: remove a block.
export const deleteBlock = (blockerId, blockedId) => {
  return blockRepository.deleteManyWhere({ blockerId, blockedId });
};

// getBlockedUsers: the users this user has blocked (with profile summary).
export const findBlockedUsers = (blockerId) => {
  return blockRepository.findAllByBlockerId(blockerId, {
    include: { blocked: { select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true } } },
  });
};

// getBlockStatus: one directional block lookup (called both ways).
export const findBlock = (blockerId, blockedId) => {
  return blockRepository.findByBlockerAndBlocked(blockerId, blockedId);
};

// ── Controller-extracted auth queries (Milestone 5I) ────────────────────
//    Each query below was inline in auth.controller.js and is moved here
//    verbatim so the controller performs no direct DB access. Queries are
//    byte-identical to the ones they replace. AUTHENTICATION BEHAVIOR IS
//    FROZEN: no token generation, cookie handling, validation, or status
//    logic lives here — the controller keeps all of that orchestration
//    exactly as it was. These are pure persistence calls only.

// register: create the new user row from the controller-assembled data.
export const createUser = (userData) => {
  return userRepository.create(userData);
};

// verifyOtp: apply the verification-state update the controller assembled.
export const updateUserById = (userId, data) => {
  return userRepository.update(userId, data);
};

// googleAuth: find an existing account by Firebase uid OR email.
export const findByFirebaseUidOrEmail = (googleId, email) => {
  return userRepository.findByFirebaseUidOrEmail(googleId, email.toLowerCase());
};