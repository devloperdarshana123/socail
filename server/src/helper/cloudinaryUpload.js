

import cloudinary from "../config/cloudinaryConfig.js";

export const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const isVideo = options.resourceType === "video";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "erovians/posts",
        resource_type: options.resourceType || "auto",

        // Images ke liye compression
        ...(!isVideo && {
          quality: "auto:good",
          fetch_format: "auto",
          width: 1080,
          crop: "limit",
        }),

        // Video ke liye thumbnail eager transform
        ...(isVideo && {
          eager: [
            {
              format: "jpg",
              transformation: [
                { start_offset: "0" },
                { width: 600, crop: "scale" },
                { quality: "auto:good" },
              ],
            },
          ],
          eager_async: false,
        }),

        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    return await cloudinary.uploader.destroy(publicId, { 
      resource_type: resourceType 
    });
  } catch (error) {
    console.warn("Cloudinary delete failed:", error.message);
    return null;
  }
};

// This function is used in Story / Highlights
export const copyToCloudinary = async (sourceUrl, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(sourceUrl, {
      folder: options.folder || "erovians/highlights",
      resource_type: options.resource_type || "image",
      ...options,
    });
    return result;
  } catch (error) {
    console.error("Copy to Cloudinary failed:", error.message);
    throw error;
  }
};