import logger from "../config/logger.js";
import AppError from "../utils/AppError.js";

// ─────────────────────────────────────────────
//  sendToken
//
//  Access token  → httpOnly: true cookie  (15 min)
//  Refresh token → httpOnly: true cookie  (7 days)
//
//  Response body mein sirf user data + nextRoute
//  Token body mein NAHI bhejte — security best practice
// ─────────────────────────────────────────────

// sendToken.js — FINAL PRODUCTION VERSION

export const sendToken = async (user, statusCode, res, options = {}, next) => {
  try {
    const deviceInfo = options.deviceInfo || "unknown";
    const ipAddress = options.ipAddress || null;

    const accessToken = user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken(deviceInfo, ipAddress);

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

    logger.info("Tokens generated successfully", { userId: user._id, statusCode });

    // Production mein accessToken body mein mat bhejo
    // Frontend cookie se kaam karega
    const responseBody = {
      success: true,
      message: options.message || "Success",
      data: user.toSafeObject(),
      nextRoute: options.nextRoute || "/feed",
    };

    // Sirf development mein body mein bhejo (debugging ke liye)
    if (!isProduction) {
      responseBody.accessToken = accessToken;
    }

    return res
      .status(statusCode)
      .cookie("accesstoken", accessToken, accessTokenOptions)
      .cookie("refreshtoken", refreshToken, refreshTokenOptions)
      .json(responseBody);

  } catch (error) {
    logger.error("Token generation failed", {
      error: error.message,
      userId: user?._id,
      stack: error.stack,
    });
    return next(new AppError("Token generation failed. Please try again.", 500));
  }
};
