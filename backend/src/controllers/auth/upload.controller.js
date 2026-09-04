// controllers/auth/upload.controller.js
import cloudinary from "../../config/cloudinaryConfig.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

// Only these folders may be targeted by a signed upload — keeps callers from
// writing into arbitrary Cloudinary paths.
const ALLOWED_FOLDERS = new Set([
  "temp_uploads",   // post/reel media (moved server-side on publish, see postHelpers.js)
  "stories",
  "chat_images",
  "chat_audio",
  "group_avatars",
]);

// ─────────────────────────────────────────────
//  GET SIGNED UPLOAD PARAMS
//  GET /api/v2/uploads/signature?folder=temp_uploads
// ─────────────────────────────────────────────
export const getUploadSignature = asyncHandler(async (req, res, next) => {
  const folder = req.query.folder;

  if (!ALLOWED_FOLDERS.has(folder)) {
    return next(new AppError("Invalid upload folder.", 400));
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    cloudinary.config().api_secret
  );

  return res.status(200).json({
    success: true,
    signature,
    timestamp,
    folder,
    apiKey: cloudinary.config().api_key,
    cloudName: cloudinary.config().cloud_name,
  });
});
