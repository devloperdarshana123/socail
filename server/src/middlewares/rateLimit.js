import rateLimit from "express-rate-limit";

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 upload requests per 15 minutes per IP
  message: {
    success: false,
    message: "Too many upload attempts. Please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
});