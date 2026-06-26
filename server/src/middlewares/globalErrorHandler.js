


import AppError from "../utils/AppError.js";
import logger from "../config/logger.js";

const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  let error = { ...err };
  error.message = message;

  // 1. Prisma — Record not found (findUniqueOrThrow / findFirstOrThrow)
  if (err.name === "NotFoundError" || err.code === "P2025") {
    error = new AppError("The requested record was not found.", 404);
  }

  // 2. Prisma — Unique constraint violation (duplicate value)
  if (err.code === "P2002") {
    const fields = err.meta?.target?.join(", ") ?? "field";
    error = new AppError(
      `Duplicate value for '${fields}'. Please use a different value.`,
      400
    );
  }

  // 3. Prisma — Foreign key constraint failed
  if (err.code === "P2003") {
    const field = err.meta?.field_name ?? "field";
    error = new AppError(
      `Related record not found for '${field}'.`,
      400
    );
  }

  // 4. Prisma — Required field missing / invalid data
  if (err.code === "P2011" || err.code === "P2012") {
    error = new AppError("Required field is missing or null.", 400);
  }

  // 5. Invalid JWT
  if (err.name === "JsonWebTokenError") {
    error = new AppError("Invalid token. Please log in again.", 401);
  }

  // 6. Expired JWT
  if (err.name === "TokenExpiredError") {
    error = new AppError("Your token has expired. Please log in again.", 401);
  }

  // 7. UserNotAuthorized
  if (err.name === "UserNotAuthorized") {
    error = new AppError("You are not authorized to perform this action.", 403);
  }

  // Log AFTER transform
  logger.error(`Error: ${error.message}`, {
    statusCode: error.statusCode || statusCode,
    stack:      err.stack,
    path:       req.originalUrl,
    method:     req.method,
    ip:         req.ip,
  });

  const isProd = process.env.NODE_ENV === "production";

  return res.status(error.statusCode || statusCode).json({
    success: false,
    message: error.message || message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};

export default globalErrorHandler;