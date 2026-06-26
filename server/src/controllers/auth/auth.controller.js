
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import prisma from "../../config/prisma.js";
import * as UserHelper from "../../utils/userHelpers.js";
import * as OtpHelper from "../../utils/otpHelpers.js";
import { sendTemplateMail } from "../../mail/index.js";
import { notifyAdmin } from "../../utils/adminNotify.js";
import logger from "../../config/logger.js";
import redis from "../../config/redis.js";
import { generateJti } from "../../utils/tokenBlacklist.js";
import { sendUserToken } from "../../utils/sendUserToken.js";
import {
  clearUserCookies,
  buildCookieOptions,
  USER_COOKIE_ACCESS,
  USER_COOKIE_REFRESH,
} from "../../utils/authCookies.js";
import { OTP_PURPOSE } from "../../utils/otpUtils.js";
import { ENV } from "../../config/env.js";
import { blacklistToken } from "../../utils/tokenBlacklist.js";
import {
  generateUsernameSuggestions,
  isValidUsername,
} from "../../utils/usernameUtils.js";
import jwt from "jsonwebtoken";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

// ═════════════════════════════════════════════
//  POST /auth/register
// ═════════════════════════════════════════════

export const register = asyncHandler(async (req, res, next) => {
  const { fullName, email, phoneNumber, password } = req.body;

  if (!fullName?.trim()) {
    return next(new AppError("Full name is required", 400));
  }

  const hasEmail = !!email?.trim();
  const hasPhone = !!phoneNumber?.trim();

  if (!hasEmail && !hasPhone) {
    return next(new AppError("Email or phone number is required", 400));
  }
  if (hasEmail && !password) {
    return next(new AppError("Password is required for email registration", 400));
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (hasEmail && !passwordRegex.test(password)) {
    return next(
      new AppError(
        "Password must be at least 8 characters with one uppercase, one lowercase, and one number",
        400,
      ),
    );
  }

  if (hasEmail) {
    const existingEmail = await UserHelper.findByEmail(email);
    if (existingEmail) return next(new AppError("An account with this email already exists", 409));
  }
  if (hasPhone) {
    const existingPhone = await UserHelper.findByPhone(phoneNumber);
    if (existingPhone) return next(new AppError("An account with this phone number already exists", 409));
  }

  const userData = {
    fullName: fullName.trim(),
    authProvider: hasEmail ? "email" : "phone",
    accountStatus: "pending",
    onboardingStep: 1,
  };
  if (hasEmail) {
    userData.email = email.toLowerCase().trim();
    userData.password = await UserHelper.hashPassword(password);
  }
  if (hasPhone) {
    userData.phoneNumber = phoneNumber.trim();
  }

  const user = await prisma.user.create({ data: userData });
  logger.info("User registered", { userId: user.id, authProvider: userData.authProvider });

  const otpPurpose = hasEmail ? OTP_PURPOSE.EMAIL_VERIFY : OTP_PURPOSE.MOBILE_VERIFY;
  const { otp } = await OtpHelper.generateOtp(user.id, otpPurpose);

  if (hasEmail) {
    sendTemplateMail(
      "emailVerify",
      { fullName: user.fullName, otp, expiresIn: "10 minutes" },
      user.email,
    ).catch((err) =>
      logger.error("Failed to send verification email", { userId: user.id, error: err.message }),
    );
  }

  return res.status(201).json({
    success: true,
    message: hasEmail
      ? "Account created. Please verify your email."
      : "Account created. Please verify your phone number.",
    data: { userId: user.id, purpose: otpPurpose, nextRoute: "/verify-otp" },
  });
});

// ═════════════════════════════════════════════
//  POST /auth/verify-otp
// ═════════════════════════════════════════════

export const verifyOtp = asyncHandler(async (req, res, next) => {
  const { userId, purpose, otp } = req.body;

  if (!userId || !purpose || !otp) {
    return next(new AppError("userId, purpose and otp are required", 400));
  }

  const result = await OtpHelper.verifyOtp(userId, purpose, otp);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.message,
      remainingAttempts: result.remainingAttempts ?? null,
    });
  }

  const user = await UserHelper.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  let nextRoute = "/feed";
  const updateData = {};

  if (purpose === OTP_PURPOSE.EMAIL_VERIFY) {
    updateData.isEmailVerified = true;
    updateData.onboardingStep = 2;
    updateData.accountStatus = "pending";
    nextRoute = "/onboarding/username";
  }
  if (purpose === OTP_PURPOSE.MOBILE_VERIFY) {
    updateData.isMobileVerified = true;
    updateData.onboardingStep = 2;
    updateData.accountStatus = "pending";
    nextRoute = "/onboarding/username";
  }
  if (purpose === OTP_PURPOSE.FORGOT_PASSWORD) {
    nextRoute = "/reset-password";
  }

  const updatedUser = Object.keys(updateData).length
    ? await prisma.user.update({ where: { id: userId }, data: updateData })
    : user;

  logger.info("OTP verified", { userId, purpose });

  await sendUserToken(updatedUser, 200, res, {
    message: "OTP verified successfully",
    nextRoute,
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress: req.ip,
  }, next);
});

// ═════════════════════════════════════════════
//  POST /auth/resend-otp
// ═════════════════════════════════════════════

export const resendOtp = asyncHandler(async (req, res, next) => {
  const { userId, purpose } = req.body;

  if (!userId || !purpose) {
    return next(new AppError("userId and purpose are required", 400));
  }

  const user = await UserHelper.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  if (purpose === OTP_PURPOSE.EMAIL_VERIFY && user.isEmailVerified) return next(new AppError("Email is already verified", 400));
  if (purpose === OTP_PURPOSE.MOBILE_VERIFY && user.isMobileVerified) return next(new AppError("Mobile is already verified", 400));

  const resendCheck = await OtpHelper.canResend(userId, purpose);
  if (!resendCheck.canResend) return next(new AppError(resendCheck.message, 429));

  const { otp } = await OtpHelper.resendOtp(userId, purpose);

  if (purpose === OTP_PURPOSE.EMAIL_VERIFY && user.email) {
    sendTemplateMail("emailVerify", { fullName: user.fullName, otp, expiresIn: "10 minutes" }, user.email)
      .catch((err) => logger.error("Resend email failed", { userId, error: err.message }));
  }
  if (purpose === OTP_PURPOSE.MOBILE_VERIFY && user.phoneNumber) {
    logger.info("SMS OTP resend triggered", { userId, phoneNumber: user.phoneNumber });
  }
  if (purpose === OTP_PURPOSE.FORGOT_PASSWORD && user.email) {
    sendTemplateMail("forgotPassword", { fullName: user.fullName, otp, expiresIn: "10 minutes" }, user.email)
      .catch((err) => logger.error("Resend forgot password email failed", { userId, error: err.message }));
  }

  logger.info("OTP resent", { userId, purpose });
  return res.status(200).json({ success: true, message: "OTP sent successfully" });
});

// ═════════════════════════════════════════════
//  POST /auth/login
// ═════════════════════════════════════════════

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  const user = await UserHelper.findByEmail(email);
  if (!user) return next(new AppError("Invalid email or password.", 401));

  const isMatch = await UserHelper.isPasswordCorrect(user, password);
  if (!isMatch) {
    logger.warn("Failed login attempt", { email, ip: req.ip });
    return next(new AppError("Incorrect password. Please try again.", 401));
  }
if (user.role === "super_admin" || user.role === "admin") {
    return next(new AppError("Access denied. Please use the admin portal to sign in.", 403));
  }
  if (user.accountStatus === "banned") return next(new AppError("Your account has been permanently banned.", 403));
  if (user.accountStatus === "suspended") return next(new AppError("Your account is temporarily suspended.", 403));
  if (user.accountStatus === "deactivated") return next(new AppError("Your account has been deactivated.", 403));

  let nextRoute = "/feed";
  if (!user.isOnboardingComplete) {
    if (user.onboardingStep === 1) nextRoute = "/verify-otp";
    else if (user.onboardingStep === 2) nextRoute = "/onboarding/username";
  }

  logger.info("User logged in", { userId: user.id, onboardingStep: user.onboardingStep });

  await sendUserToken(user, 200, res, {
    message: "Logged in successfully",
    nextRoute,
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress: req.ip,
  }, next);
});

// ═════════════════════════════════════════════
//  POST /auth/logout
// ═════════════════════════════════════════════

export const logout = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.[USER_COOKIE_REFRESH];
  const accessToken = req.cookies?.[USER_COOKIE_ACCESS];

  if (accessToken) {
    try {
      const decoded = jwt.decode(accessToken);
      if (decoded?.jti && decoded?.exp) {
        await blacklistToken(decoded.jti, decoded.exp);
      }
    } catch {
      // malformed token — ignore
    }
  }

  if (incomingRefreshToken) {
    await UserHelper.removeRefreshToken(req.user.id, incomingRefreshToken);
  }

  await redis.del(`user:${req.user.id}`).catch(() => {});
  logger.info("User logged out", { userId: req.user.id });
  return clearUserCookies(res).status(200).json({ success: true, message: "Logged out successfully" });
});

// ═════════════════════════════════════════════
//  POST /auth/refresh-token
// ═════════════════════════════════════════════

export const refreshToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.[USER_COOKIE_REFRESH];

  if (!incomingRefreshToken) {
    return next(new AppError("Refresh token missing. Please log in again.", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, ENV.USER_REFRESH_TOKEN_SECRET);
  } catch {
    return next(new AppError("Invalid or expired refresh token. Please log in again.", 401));
  }

  const user = await UserHelper.findById(decoded._id);
  if (!user) return next(new AppError("User not found.", 401));

  const storedToken = await UserHelper.getRefreshTokenByHash(user.id, incomingRefreshToken);
  const now = new Date();

  if (!storedToken || storedToken.expiresAt <= now) {
    logger.warn("Refresh token reuse or expired", { userId: user.id });
    return next(new AppError("Session invalid. Please log in again.", 401));
  }

  if (user.accountStatus === "banned" || user.accountStatus === "suspended") {
    await UserHelper.removeRefreshToken(user.id, incomingRefreshToken);
    return next(new AppError("Your account has been suspended or banned.", 403));
  }

  // Step 4 — rotate: remove old, issue new (atomic consume check)
  const consumed = await UserHelper.consumeRefreshTokenByHash(user.id, incomingRefreshToken);
  if (!consumed) {
    logger.warn("Refresh token already consumed", { userId: user.id });
    return next(new AppError("Session invalid. Please log in again.", 401));
  }

  const newAccessToken = UserHelper.generateAccessToken(user);
  const newRefreshToken = await UserHelper.generateRefreshToken(
    user,
    storedToken.deviceInfo,
    storedToken.ipAddress,
  );

  const oldAccessToken = req.cookies?.[USER_COOKIE_ACCESS];
  if (oldAccessToken) {
    try {
      const oldDecoded = jwt.decode(oldAccessToken);
      if (oldDecoded?.jti && oldDecoded?.exp) {
        await blacklistToken(oldDecoded.jti, oldDecoded.exp);
      }
    } catch { /* ignore */ }
  }

  const accessTokenOptions = buildCookieOptions({ maxAge: 15 * 60 * 1000, path: "/" });
  const refreshTokenOptions = buildCookieOptions({ maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });

  await redis.del(`user:${user.id}`).catch(() => {});
  logger.info("Access token refreshed", { userId: user.id });

  return res
    .status(200)
    .cookie(USER_COOKIE_ACCESS, newAccessToken, accessTokenOptions)
    .cookie(USER_COOKIE_REFRESH, newRefreshToken, refreshTokenOptions)
    .json({
      success: true,
      message: "Token refreshed successfully",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
});

// ═════════════════════════════════════════════
//  GET /auth/me
// ═════════════════════════════════════════════

export const getMe = asyncHandler(async (req, res) => {
  const user = req.user;

  let nextRoute = "/feed";
  if (!user.isOnboardingComplete) {
    if (user.onboardingStep === 1) nextRoute = "/verify-otp";
    else if (user.onboardingStep === 2) nextRoute = "/onboarding/username";
  }

  const safeUser = UserHelper.toSafeObject(user);

  return res.status(200).json({ success: true, data: safeUser, nextRoute });
});

// ═════════════════════════════════════════════
//  ONBOARDING
// ═════════════════════════════════════════════

export const suggestUsernames = asyncHandler(async (req, res) => {
  const user = req.user;
  const checkAvailability = async (username) => !(await UserHelper.findByUsername(username));
  const suggestions = await generateUsernameSuggestions(user.fullName, user.email || "", checkAvailability, 6);
  return res.status(200).json({ success: true, data: { suggestions } });
});

export const checkUsername = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(200).json({
      success: true,
      data: {
        username,
        available: false,
        message: "Username must be 3–30 characters and can only contain letters, numbers, dots and underscores",
      },
    });
  }
  const existing = await UserHelper.findByUsername(username);
  return res.status(200).json({
    success: true,
    data: {
      username,
      available: !existing,
      message: existing ? "Username is already taken" : "Username is available",
    },
  });
});

export const setUsername = asyncHandler(async (req, res, next) => {
  const { username } = req.body;
  if (!username?.trim()) return next(new AppError("Username is required", 400));

  const trimmed = username.trim().toLowerCase();
  if (!isValidUsername(trimmed)) {
    return next(new AppError("Username must be 3–30 characters and can only contain letters, numbers, dots and underscores", 400));
  }

  const existing = await UserHelper.findByUsername(trimmed);
  if (existing) return next(new AppError("This username is already taken", 409));

  const user = await UserHelper.findById(req.user.id);
  if (!user) return next(new AppError("User not found", 404));

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      username: trimmed,
      onboardingStep: 3,
      accountStatus: "active",
      isOnboardingComplete: true,
    },
  });

  await redis.del(`user:auth:${user.id}`).catch(() => {});

  logger.info("Username set, onboarding complete", { userId: user.id, username: trimmed });

  notifyAdmin({
    type: "admin_new_user",
    meta: {
      userId: user.id.toString(),
      username: trimmed,
      email: user.email ?? null,
      fullName: user.fullName ?? null,
    },
  }).catch(() => {});

  await sendUserToken(updatedUser, 200, res, {
    message: "Welcome to Erovians! 🎉",
    nextRoute: "/feed",
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress: req.ip,
  }, next);
});

// ═════════════════════════════════════════════
//  POST /auth/forgot-password
// ═════════════════════════════════════════════

export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email?.trim()) return next(new AppError("Email is required", 400));

  const genericMsg = "If this email is registered, an OTP has been sent.";
  const user = await UserHelper.findByEmail(email);
  if (!user || user.authProvider !== "email") {
    return res.status(200).json({ success: true, message: genericMsg });
  }

  const { otp } = await OtpHelper.generateOtp(user.id, OTP_PURPOSE.FORGOT_PASSWORD);
  sendTemplateMail("forgotPassword", { fullName: user.fullName, otp, expiresIn: "10 minutes" }, user.email)
    .catch((err) => logger.error("Forgot password email failed", { userId: user.id, error: err.message }));

  logger.info("Forgot password OTP sent", { userId: user.id });

  return res.status(200).json({
    success: true,
    message: genericMsg,
    data: { userId: user.id, purpose: OTP_PURPOSE.FORGOT_PASSWORD, nextRoute: "/verify-otp" },
  });
});

// ═════════════════════════════════════════════
//  POST /auth/reset-password  (protected)
// ═════════════════════════════════════════════

export const resetPassword = asyncHandler(async (req, res, next) => {
  const { newPassword } = req.body;
  if (!newPassword) return next(new AppError("New password is required", 400));
  if (newPassword.length < 8) return next(new AppError("Password must be at least 8 characters", 400));

  const user = await UserHelper.findById(req.user.id);
  if (!user) return next(new AppError("User not found", 404));

  const isSame = await UserHelper.isPasswordCorrect(user, newPassword);
  if (isSame) return next(new AppError("New password cannot be same as old password", 400));

  const hashedPassword = await UserHelper.hashPassword(newPassword);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  await UserHelper.removeAllRefreshTokens(user.id);
  await redis.del(`user:auth:${user.id}`).catch(() => {});

  logger.info("Password reset successful", { userId: user.id });

  await sendUserToken(updatedUser, 200, res, {
    message: "Password changed successfully.",
    nextRoute: "/feed",
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress: req.ip,
  }, next);
});

// ═════════════════════════════════════════════
//  POST /auth/google
// ═════════════════════════════════════════════

export const googleAuth = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;

  if (!idToken) {
    return next(new AppError("Google ID token is required", 400));
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch (err) {
    logger.warn("Google ID token verification failed", { error: err.message });
    return next(new AppError("Invalid or expired Google token. Please try again.", 401));
  }

  const { email, name, picture, uid: googleId } = decoded;

  if (!email) {
    return next(new AppError("Google account mein email nahi hai.", 400));
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ firebaseUid: googleId }, { email: email.toLowerCase() }],
    },
  });

  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        fullName: name || "Google User",
        email: email.toLowerCase(),
        firebaseUid: googleId,
        authProvider: "google",
        isEmailVerified: true,
        accountStatus: "pending",
        onboardingStep: 2,
        avatar: picture ? { url: picture, publicId: null } : null,
      },
    });
    logger.info("New user via Google OAuth", { userId: user.id, email });
    notifyAdmin({
      type: "admin_new_user",
      meta: {
        userId: user.id.toString(),
        username: null,
        email: user.email ?? null,
        fullName: user.fullName ?? null,
        provider: "google",
      },
    }).catch(() => {});
  } else if (!user.firebaseUid) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        firebaseUid: googleId,
        ...(!user.avatar && picture ? { avatar: { url: picture, publicId: null } } : {}),
      },
    });
    logger.info("Google account linked to existing user", { userId: user.id });
  }
if (user.role === "super_admin" || user.role === "admin") {
    return next(new AppError("Access denied. Please use the admin portal to sign in.", 403));
  }
  if (user.accountStatus === "banned") {
    return next(new AppError("Your account has been permanently banned.", 403));
  }
  if (user.accountStatus === "suspended") {
    return next(new AppError("Your account is temporarily suspended.", 403));
  }
  if (user.accountStatus === "deactivated") {
    return next(new AppError("Your account has been deactivated.", 403));
  }

  let nextRoute = "/feed";
  if (!user.isOnboardingComplete) {
    if (user.onboardingStep === 2) nextRoute = "/onboarding/username";
  }

  await sendUserToken(
    user,
    isNewUser ? 201 : 200,
    res,
    {
      message: isNewUser ? "Welcome to Erovians! 🎉" : "Signed in with Google!",
      nextRoute,
      deviceInfo: req.headers["user-agent"] || "unknown",
      ipAddress: req.ip,
    },
    next,
  );
});

// ═════════════════════════════════════════════
//  GET /auth/socket-token
// ═════════════════════════════════════════════

export const getSocketToken = asyncHandler(async (req, res) => {
  const token = jwt.sign(
    { _id: req.user.id, id: req.user.id, jti: generateJti() },
    ENV.USER_ACCESS_TOKEN_SECRET,
    { expiresIn: "1m" },
  );
  return res.status(200).json({ success: true, data: { token } });
});