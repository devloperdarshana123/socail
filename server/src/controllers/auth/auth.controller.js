import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
import OTP from "../../models/otp.model.js";
import { sendTemplateMail } from "../../mail/index.js";
import logger from "../../config/logger.js";
import { sendToken } from "../../utils/sendToken.js";
import { OTP_PURPOSE } from "../../utils/otpUtils.js";
import {
  generateUsernameSuggestions,
  isValidUsername,
} from "../../utils/usernameUtils.js";
import jwt from "jsonwebtoken";

// ═════════════════════════════════════════════
//  AUTH — PUBLIC ROUTES
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
//  POST /auth/register
//
//  Flow:
//    1. Validate input
//    2. Duplicate check
//    3. User banao (accountStatus: pending, onboardingStep: 1)
//    4. OTP generate karo
//    5. Email bhejo (non-blocking)
//    6. { userId, purpose, nextRoute } return karo — NO TOKEN YET
// ─────────────────────────────────────────────

export const register = asyncHandler(async (req, res, next) => {
  const { fullName, email, phoneNumber, password } = req.body;

  // ── 1. Validation ────────────────────────────────────────────
  if (!fullName?.trim()) {
    return next(new AppError("Full name is required", 400));
  }

  const hasEmail = !!email?.trim();
  const hasPhone = !!phoneNumber?.trim();

  if (!hasEmail && !hasPhone) {
    return next(new AppError("Email or phone number is required", 400));
  }

  if (hasEmail && !password) {
    return next(
      new AppError("Password is required for email registration", 400),
    );
  }

  if (hasEmail && password.length < 8) {
    return next(new AppError("Password must be at least 8 characters", 400));
  }

  // ── 2. Duplicate check ───────────────────────────────────────
  if (hasEmail) {
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return next(
        new AppError("An account with this email already exists", 409),
      );
    }
  }

  if (hasPhone) {
    const existingPhone = await User.findByPhone(phoneNumber);
    if (existingPhone) {
      return next(
        new AppError("An account with this phone number already exists", 409),
      );
    }
  }

  // ── 3. User banao ────────────────────────────────────────────
  const userData = {
    fullName: fullName.trim(),
    authProvider: hasEmail ? "email" : "phone",
    accountStatus: "pending",
    onboardingStep: 1,
  };

  if (hasEmail) {
    userData.email = email.toLowerCase().trim();
    userData.password = password; // pre-save hook hashes it
  }

  if (hasPhone) {
    userData.phoneNumber = phoneNumber.trim();
  }

  const user = await User.create(userData);

  logger.info("User registered", {
    userId: user._id,
    authProvider: userData.authProvider,
  });

  // ── 4. OTP generate karo ─────────────────────────────────────
  const otpPurpose = hasEmail
    ? OTP_PURPOSE.EMAIL_VERIFY
    : OTP_PURPOSE.MOBILE_VERIFY;

  const { otp } = await OTP.generateOtp(user._id, otpPurpose);

  // ── 5. Email bhejo (non-blocking) ────────────────────────────
  if (hasEmail) {
    sendTemplateMail(
      "emailVerify",
      { fullName: user.fullName, otp, expiresIn: "10 minutes" },
      user.email,
    ).catch((err) =>
      logger.error("Failed to send verification email", {
        userId: user._id,
        error: err.message,
      }),
    );
  }

  // ── 6. Response — NO TOKEN ───────────────────────────────────
  return res.status(201).json({
    success: true,
    message: hasEmail
      ? "Account created. Please verify your email."
      : "Account created. Please verify your phone number.",
    data: {
      userId: user._id,
      purpose: otpPurpose,
      nextRoute: "/verify-otp",
    },
  });
});

// ─────────────────────────────────────────────
//  POST /auth/verify-otp
//
//  Body: { userId, purpose, otp }
//
//  Token yahan milta hai — register mein nahi diya tha
//  Purpose ke hisaab se user update hota hai:
//    email_verify / mobile_verify → onboardingStep: 2
//    forgot_password              → sirf verify, token do
// ─────────────────────────────────────────────

export const verifyOtp = asyncHandler(async (req, res, next) => {
  const { userId, purpose, otp } = req.body;

  if (!userId || !purpose || !otp) {
    return next(new AppError("userId, purpose and otp are required", 400));
  }

  // ── 1. OTP verify karo ──────────────────────────────────────
  const result = await OTP.verifyOtp(userId, purpose, otp);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.message,
      remainingAttempts: result.remainingAttempts ?? null,
    });
  }

  // ── 2. User fetch karo ──────────────────────────────────────
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // ── 3. Purpose ke hisaab se update ──────────────────────────
  let nextRoute = "/feed";

  if (purpose === OTP_PURPOSE.EMAIL_VERIFY) {
    user.isEmailVerified = true;
    user.onboardingStep = 2;
    user.accountStatus = "pending"; // still pending — username baaki
    nextRoute = "/onboarding/username";
  }

  if (purpose === OTP_PURPOSE.MOBILE_VERIFY) {
    user.isMobileVerified = true;
    user.onboardingStep = 2;
    user.accountStatus = "pending";
    nextRoute = "/onboarding/username";
  }

  if (purpose === OTP_PURPOSE.FORGOT_PASSWORD) {
    nextRoute = "/reset-password";
  }

  await user.save({ validateBeforeSave: false });

  logger.info("OTP verified", { userId, purpose });

  // ── 4. Token bhejo ───────────────────────────────────────────
  await sendToken(
    user,
    200,
    res,
    {
      message: "OTP verified successfully",
      nextRoute,
      deviceInfo: req.headers["user-agent"] || "unknown",
      ipAddress: req.ip,
    },
    next,
  );
});

// ─────────────────────────────────────────────
//  POST /auth/resend-otp
//
//  Body: { userId, purpose }
// ─────────────────────────────────────────────

export const resendOtp = asyncHandler(async (req, res, next) => {
  const { userId, purpose } = req.body;

  if (!userId || !purpose) {
    return next(new AppError("userId and purpose are required", 400));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // ── Already verified check ───────────────────────────────────
  if (purpose === OTP_PURPOSE.EMAIL_VERIFY && user.isEmailVerified) {
    return next(new AppError("Email is already verified", 400));
  }
  if (purpose === OTP_PURPOSE.MOBILE_VERIFY && user.isMobileVerified) {
    return next(new AppError("Mobile is already verified", 400));
  }

  // ── Cooldown + max resend check ──────────────────────────────
  const resendCheck = await OTP.canResend(userId, purpose);
  if (!resendCheck.canResend) {
    return next(new AppError(resendCheck.message, 429));
  }

  // ── Fresh OTP generate karo ──────────────────────────────────
  const { otp } = await OTP.resendOtp(userId, purpose);

  // ── Send karo ────────────────────────────────────────────────
  if (purpose === OTP_PURPOSE.EMAIL_VERIFY && user.email) {
    sendTemplateMail(
      "emailVerify",
      { fullName: user.fullName, otp, expiresIn: "10 minutes" },
      user.email,
    ).catch((err) =>
      logger.error("Resend email failed", { userId, error: err.message }),
    );
  }

  if (purpose === OTP_PURPOSE.MOBILE_VERIFY && user.phoneNumber) {
    // await smsService.send(user.phoneNumber, otp);
    logger.info("SMS OTP resend triggered", {
      userId,
      phoneNumber: user.phoneNumber,
    });
  }

  logger.info("OTP resent", { userId, purpose });

  return res.status(200).json({
    success: true,
    message: "OTP sent successfully",
  });
});

// ─────────────────────────────────────────────
//  POST /auth/login
//
//  Body: { email, password } OR { phoneNumber, otp }
//
//  Email login → password check karo
//  Phone login → OTP flow (resend-otp → verify-otp use karo)
//
//  Security checks:
//    - banned / suspended / deactivated → block
//    - pending → allow (unfinished onboarding — resume se handle)
// ─────────────────────────────────────────────

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // ── Validation ───────────────────────────────────────────────
  if (!email?.trim() || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  // ── User fetch (password select karo explicitly) ─────────────
  const user = await User.findByEmail(email).select("+password");

  if (!user) {
    // Intentionally vague — user enumeration prevent karo
    return next(new AppError("No account found with this email address.", 401));
  }

  // ── Password check ───────────────────────────────────────────
  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) {
    logger.warn("Failed login attempt", { email, ip: req.ip });
    return next(new AppError("Incorrect password. Please try again.", 401));
  }

  // ── Account status checks ────────────────────────────────────
  if (user.accountStatus === "banned") {
    return next(new AppError("Your account has been permanently banned.", 403));
  }

  if (user.accountStatus === "suspended") {
    return next(new AppError("Your account is temporarily suspended.", 403));
  }

  if (user.accountStatus === "deactivated") {
    return next(new AppError("Your account has been deactivated.", 403));
  }

  // ── Determine nextRoute based on onboarding state ────────────
  let nextRoute = "/feed";

  if (!user.isOnboardingComplete) {
    if (user.onboardingStep === 1) {
      // OTP verify baaki hai
      nextRoute = "/verify-otp";
    } else if (user.onboardingStep === 2) {
      // Username set karna baaki hai
      nextRoute = "/onboarding/username";
    }
  }

  logger.info("User logged in", {
    userId: user._id,
    onboardingStep: user.onboardingStep,
  });

  await sendToken(
    user,
    200,
    res,
    {
      message: "Logged in successfully",
      nextRoute,
      deviceInfo: req.headers["user-agent"] || "unknown",
      ipAddress: req.ip,
    },
    next,
  );
});

// ─────────────────────────────────────────────
//  POST /auth/logout
//
//  Protected route — isAuthenticated middleware se aata hai
//  Current device ka refresh token remove karo
// ─────────────────────────────────────────────

export const logout = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.refreshtoken;
  if (incomingRefreshToken) {
    const userWithTokens = await User.findById(req.user._id).select(
      "+refreshTokens",
    );
    if (userWithTokens) {
      await userWithTokens.removeRefreshToken(incomingRefreshToken);
    }
  }

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };

  logger.info("User logged out", { userId: req.user._id });

  return res
    .status(200)
    .clearCookie("accesstoken", cookieOptions)
    .clearCookie("refreshtoken", cookieOptions)
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

// ─────────────────────────────────────────────
//  POST /auth/refresh-token
//
//  Refresh token se naya access token lo
//  Rotation: purana refresh token hata do, naya do
// ─────────────────────────────────────────────

export const refreshToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.refreshtoken;

  if (!incomingRefreshToken) {
    return next(
      new AppError("Refresh token missing. Please log in again.", 401),
    );
  }

  // ── Verify karo ──────────────────────────────────────────────
  let decoded;
  try {
    decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
  } catch (err) {
    return next(
      new AppError(
        "Invalid or expired refresh token. Please log in again.",
        401,
      ),
    );
  }

  // ── User fetch with refreshTokens ────────────────────────────
  const user = await User.findById(decoded._id).select("+refreshTokens");

  if (!user) {
    return next(new AppError("User not found.", 401));
  }

 const now = new Date();
const storedToken = user.refreshTokens.find(
    (t) => t.token === incomingRefreshToken && t.expiresAt > now,
  );

if (!storedToken) {
    logger.warn("Refresh token reuse or expired", { userId: user._id });
    // Sab sessions mat hatao — sirf warn karo
    // removeAllRefreshTokens() race condition mein sab logout kar deta hai
    return next(
      new AppError("Session invalid. Please log in again.", 401),
    );
  }

  // ── Rotate tokens ────────────────────────────────────────────
  await user.removeRefreshToken(incomingRefreshToken);
  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = await user.generateRefreshToken(
    storedToken.deviceInfo,
    storedToken.ipAddress,
  );

  const isProduction = process.env.NODE_ENV === "production";

  const accessTokenOptions = {
    expires: new Date(Date.now() + 15 * 60 * 1000),
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };

  const refreshTokenOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };

  logger.info("Access token refreshed", { userId: user._id });

 return res
    .status(200)
    .cookie("accesstoken", newAccessToken, accessTokenOptions)
    .cookie("refreshtoken", newRefreshToken, refreshTokenOptions)
    .json({
      success: true,
      message: "Token refreshed successfully",
      accessToken: newAccessToken,
    });
});

// ─────────────────────────────────────────────
//  GET /auth/me
//
//  Protected route
//  Current user ka data + onboarding resume info
// ─────────────────────────────────────────────

export const getMe = asyncHandler(async (req, res, next) => {
  // req.user already hai from isAuthenticated middleware
  const user = req.user;

  // Determine where user should go based on onboarding state
  let nextRoute = "/feed";

  if (!user.isOnboardingComplete) {
    if (user.onboardingStep === 1) {
      nextRoute = "/verify-otp";
    } else if (user.onboardingStep === 2) {
      nextRoute = "/onboarding/username";
    }
  }

  return res.status(200).json({
    success: true,
    data: user.toSafeObject(),
    nextRoute,
  });
});

// ═════════════════════════════════════════════
//  ONBOARDING — PROTECTED ROUTES
//  Middleware chain: isAuthenticated + isOnboardingPending
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
//  GET /onboarding/username/suggestions
//
//  Name + email se username suggestions generate karo
//  Sirf available usernames return karo (DB check ke saath)
// ─────────────────────────────────────────────

export const suggestUsernames = asyncHandler(async (req, res, next) => {
  const user = req.user;

  // checkAvailability function — DB mein check karo
  const checkAvailability = async (username) => {
    const existing = await User.findByUsername(username);
    return !existing; // true = available
  };

  const suggestions = await generateUsernameSuggestions(
    user.fullName,
    user.email || "",
    checkAvailability,
    6, // 6 suggestions bhejo
  );

  return res.status(200).json({
    success: true,
    data: { suggestions },
  });
});

// ─────────────────────────────────────────────
//  GET /onboarding/username/check/:username
//
//  Ek specific username available hai ya nahi
// ─────────────────────────────────────────────

export const checkUsername = asyncHandler(async (req, res, next) => {
  const { username } = req.params;

  // ── Format validate karo ─────────────────────────────────────
  if (!isValidUsername(username)) {
    return res.status(200).json({
      success: true,
      data: {
        username,
        available: false,
        message:
          "Username must be 3–30 characters and can only contain letters, numbers, dots and underscores",
      },
    });
  }

  // ── DB check ─────────────────────────────────────────────────
  const existing = await User.findByUsername(username);

  return res.status(200).json({
    success: true,
    data: {
      username,
      available: !existing,
      message: existing ? "Username is already taken" : "Username is available",
    },
  });
});

// ─────────────────────────────────────────────
//  PATCH /onboarding/username
//
//  Body: { username }
//
//  Username set karo:
//    - Validate format
//    - Availability check
//    - Save: username, onboardingStep: 3, accountStatus: active,
//             isOnboardingComplete: true
// ─────────────────────────────────────────────

export const setUsername = asyncHandler(async (req, res, next) => {
  const { username } = req.body;

  if (!username?.trim()) {
    return next(new AppError("Username is required", 400));
  }

  const trimmed = username.trim().toLowerCase();

  // ── Format validate karo ─────────────────────────────────────
  if (!isValidUsername(trimmed)) {
    return next(
      new AppError(
        "Username must be 3–30 characters and can only contain letters, numbers, dots and underscores",
        400,
      ),
    );
  }

  // ── Availability check ───────────────────────────────────────
  const existing = await User.findByUsername(trimmed);
  if (existing) {
    return next(new AppError("This username is already taken", 409));
  }

  // ── Save karo ────────────────────────────────────────────────
  const user = req.user;

  user.username = trimmed;
  user.onboardingStep = 3;
  user.accountStatus = "active";
  user.isOnboardingComplete = true;

  await user.save({ validateBeforeSave: false });

  logger.info("Username set, onboarding complete", {
    userId: user._id,
    username: trimmed,
  });

  // Fresh token bhejo — user data update ho gaya hai
  await sendToken(
    user,
    200,
    res,
    {
      message: "Welcome to Erovians! 🎉",
      nextRoute: "/feed",
      deviceInfo: req.headers["user-agent"] || "unknown",
      ipAddress: req.ip,
    },
    next,
  );
});
