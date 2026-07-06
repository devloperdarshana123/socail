

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
       else {
  if (isVideo && result.eager?.[0]?.secure_url) {
    result.thumbnailUrl = result.eager[0].secure_url;
  }
  resolve(result);
}
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


// existing imports ke saath, file ke end mein add karo

export const finalizeMedia = async (mediaArr = []) => {
  return Promise.all(
    mediaArr.map(async (m) => {
      if (!m.publicId?.startsWith("temp_uploads/")) return m; // already finalized ya purana media

      const newPublicId = m.publicId.replace("temp_uploads/", "erovians/posts/");

      try {
        const result = await cloudinary.uploader.rename(m.publicId, newPublicId, {
          resource_type: m.resourceType || "image",
        });
        return {
          ...m,
          publicId: result.public_id,
          url: result.secure_url,
        };
      } catch (error) {
        console.warn("Media finalize (rename) failed:", error.message);
        return m; // fallback — cron isay baad mein handle kar lega
      }
    })
  );
};