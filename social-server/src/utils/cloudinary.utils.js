import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Upload (buffer → cloudinary) ─────────────────────────────────────────────
export const uploadToCloudinary = (buffer, folder = "erovians", options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",   // image/video dono handle karta hai
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ── Destroy (public_id se delete) ────────────────────────────────────────────
export const destroyFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

// ── Public ID extract (URL se) ───────────────────────────────────────────────
export const getPublicId = (url = "") => {
  // e.g. https://res.cloudinary.com/demo/image/upload/v123/erovians/abc.jpg
  // → erovians/abc
  const parts = url.split("/upload/");
  if (parts.length < 2) return null;
  return parts[1].replace(/^v\d+\//, "").replace(/\.[^/.]+$/, "");
};