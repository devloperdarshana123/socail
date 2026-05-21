// import AppError from "../utils/AppError.js";
// import logger from "../config/logger.js";

// const globalErrorHandler = (err, req, res, next) => {
//   const statusCode = err.statusCode || 500;
//   const message = err.message || "Internal Server Error";

//   let error = { ...err };
//   error.message = message;

//   logger.error(`Error occurred: ${err.message}`, {
//     statusCode,
//     stack: err.stack,
//     path: req.originalUrl,
//     method: req.method,
//     ip: req.ip,
//   });

//   // -----------------------------
//   // 1️⃣ CastError
//   // -----------------------------
//   if ("name" in err && err.name === "CastError") {
//     error = new AppError(`Invalid ${err.path}: ${err.value}.`, 400);
//     logger.warn(`CastError: Invalid ${err.path} - ${err.value}`);
//   }

//   // -----------------------------
//   // 2️⃣ Duplicate Key Error
//   // -----------------------------
//   if ("code" in err && err.code === 11000) {
//     const keyValue = err.keyValue ?? {};
//     const field = Object.keys(keyValue)[0] ?? "";
//     const value = keyValue[field];
//     const duplicateMsg = value
//       ? `Duplicate value '${value}' found for field '${field}'. Please use a different value.`
//       : `Duplicate value found for field '${field}'.`;
//     error = new AppError(duplicateMsg, 400);
//     logger.warn(`Duplicate Key Error: ${field} = ${value}`);
//   }

//   // -----------------------------
//   // 3️⃣ Invalid JWT
//   // -----------------------------
//   if ("name" in err && err.name === "JsonWebTokenError") {
//     error = new AppError("Invalid token. Please log in again.", 401);
//     logger.warn("Invalid JWT token attempt");
//   }

//   // -----------------------------
//   // 4️⃣ Expired JWT
//   // -----------------------------
//   if ("name" in err && err.name === "TokenExpiredError") {
//     error = new AppError("Your token has expired. Please log in again.", 401);
//     logger.warn("Expired JWT token attempt");
//   }

//   // -----------------------------
//   // 5️⃣ Unauthorized (Custom)
//   // -----------------------------
//   if ("name" in err && err.name === "UserNotAuthorized") {
//     error = new AppError("You are not authorized to perform this action.", 403);
//     logger.warn("Unauthorized access attempt", { path: req.originalUrl });
//   }

//   // -----------------------------
//   // Final Response
//   // -----------------------------
//   res.status(error.statusCode || statusCode).json({
//     success: false,
//     message: error.message || message,
//     error,
//   });
// };

// export default globalErrorHandler;



import AppError from "../utils/AppError.js";
import logger from "../config/logger.js";

const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  let error = { ...err };
  error.message = message;

  logger.error(`Error: ${err.message}`, {
    statusCode,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // 1. CastError
  if (err.name === "CastError") {
    error = new AppError(`Invalid ${err.path}: ${err.value}.`, 400);
  }

  // 2. Duplicate Key
  if (err.code === 11000) {
    const keyValue = err.keyValue ?? {};
    const field = Object.keys(keyValue)[0] ?? "";
    const value = keyValue[field];
    const msg = value
      ? `Duplicate value '${value}' for field '${field}'. Please use a different value.`
      : `Duplicate value for field '${field}'.`;
    error = new AppError(msg, 400);
  }

  // 3. Mongoose ValidationError — CHANGE 1: ye missing tha
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new AppError(messages.join(". "), 400);
  }

  // 4. Invalid JWT
  if (err.name === "JsonWebTokenError") {
    error = new AppError("Invalid token. Please log in again.", 401);
  }

  // 5. Expired JWT
  if (err.name === "TokenExpiredError") {
    error = new AppError("Your token has expired. Please log in again.", 401);
  }

  // 6. UserNotAuthorized
  if (err.name === "UserNotAuthorized") {
    error = new AppError("You are not authorized to perform this action.", 403);
  }

  const isProd = process.env.NODE_ENV === "production";

  // CHANGE 2: `error` object response mein mat bhejo — stack trace expose hota tha
  return res.status(error.statusCode || statusCode).json({
    success: false,
    message: error.message || message,
    // Sirf development mein stack dikhao
    ...(isProd ? {} : { stack: err.stack }),
  });
};

export default globalErrorHandler;