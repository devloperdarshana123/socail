// src/middleware/errorHandler.js
import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error("❌ Unhandled error", { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
  message: process.env.NODE_ENV === "production"
    ? "Internal Server Error"
    : (err.message || "Internal Server Error"),
});
};