import multer from "multer";
import AppError from "../utils/AppError.js";

// ── Store in memory (buffer) — Cloudinary ko seedha bhejenge ──
const storage = multer.memoryStorage();

// ── Allowed types ──
const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",   // .mov
  "video/x-msvideo",  // .avi
  "video/mpeg",
];

// ── File filter — images + videos ──
const fileFilter = (req, file, cb) => {
  const allAllowed = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES];

  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Only images (JPEG, PNG, WEBP, GIF) and videos (MP4, WEBM, MOV, AVI) are allowed.",
        400
      ),
      false
    );
  }
};

// ── Image only filter — profile/cover photo ke liye ──
const imageOnlyFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError("Only JPEG, PNG, WEBP, and GIF images are allowed.", 400),
      false
    );
  }
};

// ── Multer instances ──
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 100MB — videos ke liye
  },
});

const uploadImageOnly = multer({
  storage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB — images ke liye
  },
});

// ── Named exports ──
export const uploadSingle = (fieldName) => upload.single(fieldName);
export const uploadMultiple = (fieldName, maxCount) =>
  upload.array(fieldName, maxCount);
export const uploadFields = (fields) => upload.fields(fields);

// Image only — profile/cover photo routes pe use karo
export const uploadImageSingle = (fieldName) =>
  uploadImageOnly.single(fieldName);
export const uploadImageFields = (fields) => uploadImageOnly.fields(fields);

export default upload;