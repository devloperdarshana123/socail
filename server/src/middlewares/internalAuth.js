import AppError from "../utils/AppError.js";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export const internalAuth = (req, res, next) => {
  const secret = req.headers["x-internal-secret"];

  if (!secret || secret !== INTERNAL_SECRET) {
    return next(new AppError("Unauthorized internal request.", 403));
  }

  next();
};