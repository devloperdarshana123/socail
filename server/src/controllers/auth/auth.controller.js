

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
import OTP from "../../models/otp.model.js";
import { sendTemplateMail } from "../../mail/index.js";
import logger from "../../config/logger.js";
import { sendToken, clearAuthCookies, COOKIE_ACCESS, COOKIE_REFRESH } from "../../utils/sendToken.js";
import { OTP_PURPOSE } from "../../utils/otpUtils.js";
import { ENV } from "../../config/env.js";
import { blacklistToken } from "../../utils/tokenBlacklist.js";
import {
  generateUsernameSuggestions,
  isValidUsername,
} from "../../utils/usernameUtils.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// ─────────────────────────────────────────────
//  Internal helper — must match User model's hashToken
// ─────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
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
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) return next(new AppError("An account with this email already exists", 409));
  }
  if (hasPhone) {
    const existingPhone = await User.findByPhone(phoneNumber);
    if (existingPhone) return next(new AppError("An account with this phone number already exists", 409));
  }

  const userData = {
    fullName     : fullName.trim(),
    authProvider : hasEmail ? "email" : "phone",
    accountStatus: "pending",
    onboardingStep: 1,
  };
  if (hasEmail) {
    userData.email    = email.toLowerCase().trim();
    userData.password = password;
  }
  if (hasPhone) {
    userData.phoneNumber = phoneNumber.trim();
  }

  const user = await User.create(userData);
  logger.info("User registered", { userId: user._id, authProvider: userData.authProvider });

  const otpPurpose = hasEmail ? OTP_PURPOSE.EMAIL_VERIFY : OTP_PURPOSE.MOBILE_VERIFY;
  const { otp } = await OTP.generateOtp(user._id, otpPurpose);

  if (hasEmail) {
    sendTemplateMail(
      "emailVerify",
      { fullName: user.fullName, otp, expiresIn: "10 minutes" },
      user.email,
    ).catch((err) =>
      logger.error("Failed to send verification email", { userId: user._id, error: err.message }),
    );
  }

  return res.status(201).json({
    success: true,
    message: hasEmail
      ? "Account created. Please verify your email."
      : "Account created. Please verify your phone number.",
    data: { userId: user._id, purpose: otpPurpose, nextRoute: "/verify-otp" },
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

  const result = await OTP.verifyOtp(userId, purpose, otp);
  if (!result.success) {
    return res.status(400).json({
      success           : false,
      message           : result.message,
      remainingAttempts : result.remainingAttempts ?? null,
    });
  }

  const user = await User.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  let nextRoute = "/feed";
  if (purpose === OTP_PURPOSE.EMAIL_VERIFY) {
    user.isEmailVerified = true;
    user.onboardingStep  = 2;
    user.accountStatus   = "pending";
    nextRoute            = "/onboarding/username";
  }
  if (purpose === OTP_PURPOSE.MOBILE_VERIFY) {
    user.isMobileVerified = true;
    user.onboardingStep   = 2;
    user.accountStatus    = "pending";
    nextRoute             = "/onboarding/username";
  }
  if (purpose === OTP_PURPOSE.FORGOT_PASSWORD) {
    nextRoute = "/reset-password";
  }

  await user.save({ validateBeforeSave: false });
  logger.info("OTP verified", { userId, purpose });

  await sendToken(user, 200, res, {
    message   : "OTP verified successfully",
    nextRoute,
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress : req.ip,
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

  const user = await User.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  if (purpose === OTP_PURPOSE.EMAIL_VERIFY  && user.isEmailVerified)  return next(new AppError("Email is already verified", 400));
  if (purpose === OTP_PURPOSE.MOBILE_VERIFY && user.isMobileVerified) return next(new AppError("Mobile is already verified", 400));

  const resendCheck = await OTP.canResend(userId, purpose);
  if (!resendCheck.canResend) return next(new AppError(resendCheck.message, 429));

  const { otp } = await OTP.resendOtp(userId, purpose);

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

  // select("+password") fetches password for bcrypt compare.
  // toSafeObject() works fine on this doc — it only reads other fields.
  const user = await User.findByEmail(email).select("+password");
  if (!user) return next(new AppError("Invalid email or password.", 401));

  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) {
    logger.warn("Failed login attempt", { email, ip: req.ip });
    return next(new AppError("Incorrect password. Please try again.", 401));
  }

  if (user.accountStatus === "banned")       return next(new AppError("Your account has been permanently banned.", 403));
  if (user.accountStatus === "suspended")    return next(new AppError("Your account is temporarily suspended.", 403));
  if (user.accountStatus === "deactivated")  return next(new AppError("Your account has been deactivated.", 403));

  let nextRoute = "/feed";
  if (!user.isOnboardingComplete) {
    if      (user.onboardingStep === 1) nextRoute = "/verify-otp";
    else if (user.onboardingStep === 2) nextRoute = "/onboarding/username";
  }

  logger.info("User logged in", { userId: user._id, onboardingStep: user.onboardingStep });

  await sendToken(user, 200, res, {
    message   : "Logged in successfully",
    nextRoute,
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress : req.ip,
  }, next);
});

// ═════════════════════════════════════════════
//  POST /auth/logout
// ═════════════════════════════════════════════

// export const logout = asyncHandler(async (req, res, next) => {
//   const incomingRefreshToken = req.cookies?.[COOKIE_REFRESH];

//   if (incomingRefreshToken) {
//     // User model stores tokenHash, not raw token — removeRefreshToken hashes internally
//     const userWithTokens = await User.findById(req.user._id).select("+refreshTokens");
//     if (userWithTokens) {
//       await userWithTokens.removeRefreshToken(incomingRefreshToken);
//     }
//   }

//   logger.info("User logged out", { userId: req.user._id });
//   return clearAuthCookies(res).status(200).json({ success: true, message: "Logged out successfully" });
// });



export const logout = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.[COOKIE_REFRESH];
  const accessToken          = req.cookies?.[COOKIE_ACCESS];

  // Step 1: Access token blacklist karo — logout ke baad use na ho sake
  if (accessToken) {
    try {
      const decoded = jwt.decode(accessToken);
      if (decoded?.jti && decoded?.exp) {
        await blacklistToken(decoded.jti, decoded.exp);
      }
    } catch {
      // malformed token — ignore, logout proceed karo
    }
  }

  // Step 2: Refresh token DB se hatao (existing logic same)
  if (incomingRefreshToken) {
    const userWithTokens = await User.findById(req.user._id).select("+refreshTokens");
    if (userWithTokens) {
      await userWithTokens.removeRefreshToken(incomingRefreshToken);
    }
  }

  logger.info("User logged out", { userId: req.user._id });
  return clearAuthCookies(res).status(200).json({ success: true, message: "Logged out successfully" });
});
// ═════════════════════════════════════════════
//  POST /auth/refresh-token
// ═════════════════════════════════════════════

export const refreshToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.[COOKIE_REFRESH];

  if (!incomingRefreshToken) {
    return next(new AppError("Refresh token missing. Please log in again.", 401));
  }

  // Step 1 — verify JWT signature + expiry
  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, ENV.REFRESH_TOKEN_SECRET);
  } catch {
    return next(new AppError("Invalid or expired refresh token. Please log in again.", 401));
  }

  // Step 2 — fetch user with refreshTokens array
  const user = await User.findById(decoded._id).select("+refreshTokens");
  if (!user) return next(new AppError("User not found.", 401));

  // Step 3 — look up by tokenHash (User model stores hash, never raw token)
  const incomingHash = hashToken(incomingRefreshToken);
  const now          = new Date();
  const storedToken  = user.refreshTokens.find(
    (t) => t.tokenHash === incomingHash && t.expiresAt > now,
  );

  if (!storedToken) {
    logger.warn("Refresh token reuse or expired", { userId: user._id });
    return next(new AppError("Session invalid. Please log in again.", 401));
  }

  // Step 4 — rotate: remove old, issue new
  await user.removeRefreshToken(incomingRefreshToken);
 

  const oldAccessToken = req.cookies?.[COOKIE_ACCESS];
if (oldAccessToken) {
  try {
    const oldDecoded = jwt.decode(oldAccessToken);
    if (oldDecoded?.jti && oldDecoded?.exp) {
      await blacklistToken(oldDecoded.jti, oldDecoded.exp);
    }
  } catch { /* ignore */ }
}

 const newAccessToken  = user.generateAccessToken();
  const newRefreshToken = await user.generateRefreshToken(
    storedToken.deviceInfo,
    storedToken.ipAddress,
  );

  const isProduction = process.env.NODE_ENV === "production";

  const accessTokenOptions = {
    maxAge  : 15 * 60 * 1000,
    httpOnly: true,
    path    : "/",
    sameSite: isProduction ? "none" : "lax",
    secure  : isProduction,
  };
  const refreshTokenOptions = {
    maxAge  : 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    path    : "/",
    sameSite: isProduction ? "none" : "lax",
    secure  : isProduction,
  };

  logger.info("Access token refreshed", { userId: user._id });

  return res
    .status(200)
    .cookie(COOKIE_ACCESS,  newAccessToken,  accessTokenOptions)
    .cookie(COOKIE_REFRESH, newRefreshToken, refreshTokenOptions)
    .json({
      success: true,
      message: "Token refreshed successfully",
      ...(process.env.NODE_ENV === "development" && { accessToken: newAccessToken }),
    });
});

// ═════════════════════════════════════════════
//  GET /auth/me
// ═════════════════════════════════════════════

export const getMe = asyncHandler(async (req, res) => {
  const user = req.user;

  let nextRoute = "/feed";
  if (!user.isOnboardingComplete) {
    if      (user.onboardingStep === 1) nextRoute = "/verify-otp";
    else if (user.onboardingStep === 2) nextRoute = "/onboarding/username";
  }

  return res.status(200).json({ success: true, data: user.toSafeObject(), nextRoute });
});

// ═════════════════════════════════════════════
//  ONBOARDING
// ═════════════════════════════════════════════

export const suggestUsernames = asyncHandler(async (req, res) => {
  const user = req.user;
  const checkAvailability = async (username) => !(await User.findByUsername(username));
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
        message  : "Username must be 3–30 characters and can only contain letters, numbers, dots and underscores",
      },
    });
  }
  const existing = await User.findByUsername(username);
  return res.status(200).json({
    success: true,
    data: {
      username,
      available: !existing,
      message  : existing ? "Username is already taken" : "Username is available",
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

  const existing = await User.findByUsername(trimmed);
  if (existing) return next(new AppError("This username is already taken", 409));

  const user = req.user;
  user.username             = trimmed;
  user.onboardingStep       = 3;
  user.accountStatus        = "active";
  user.isOnboardingComplete = true;
  await user.save({ validateBeforeSave: false });

  logger.info("Username set, onboarding complete", { userId: user._id, username: trimmed });

  await sendToken(user, 200, res, {
    message   : "Welcome to Erovians! 🎉",
    nextRoute : "/feed",
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress : req.ip,
  }, next);
});

// ═════════════════════════════════════════════
//  POST /auth/forgot-password
// ═════════════════════════════════════════════

export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email?.trim()) return next(new AppError("Email is required", 400));

  const genericMsg = "If this email is registered, an OTP has been sent.";
  const user = await User.findByEmail(email);
  if (!user || user.authProvider !== "email") {
    return res.status(200).json({ success: true, message: genericMsg });
  }

  const { otp } = await OTP.generateOtp(user._id, OTP_PURPOSE.FORGOT_PASSWORD);
  sendTemplateMail("forgotPassword", { fullName: user.fullName, otp, expiresIn: "10 minutes" }, user.email)
    .catch((err) => logger.error("Forgot password email failed", { userId: user._id, error: err.message }));

  logger.info("Forgot password OTP sent", { userId: user._id });

  return res.status(200).json({
    success: true,
    message: genericMsg,
    data: { userId: user._id, purpose: OTP_PURPOSE.FORGOT_PASSWORD, nextRoute: "/verify-otp" },
  });
});

// ═════════════════════════════════════════════
//  POST /auth/reset-password  (protected)
// ═════════════════════════════════════════════

export const resetPassword = asyncHandler(async (req, res, next) => {
  const { newPassword } = req.body;
  if (!newPassword)          return next(new AppError("New password is required", 400));
  if (newPassword.length < 8) return next(new AppError("Password must be at least 8 characters", 400));

  const user = await User.findById(req.user._id).select("+password +refreshTokens");
  if (!user) return next(new AppError("User not found", 404));

  const isSame = await user.isPasswordCorrect(newPassword);
  if (isSame) return next(new AppError("New password cannot be same as old password", 400));

  user.password      = newPassword;
  user.refreshTokens = [];
  await user.save({ validateBeforeSave: false });

  logger.info("Password reset successful, all sessions cleared", { userId: user._id });

  return clearAuthCookies(res)
    .status(200)
    .json({ success: true, message: "Password reset successfully. Please log in again." });
});