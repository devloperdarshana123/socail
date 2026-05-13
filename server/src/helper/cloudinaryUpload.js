import cloudinary from "../config/cloudinaryConfig.js";

export const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {

    const isVideo = options.resourceType === "video";  // ← Promise ke andar, sabse upar

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:        options.folder || "erovians/posts",
        resource_type: options.resourceType || "auto",
        transformation: options.transformation || [],
        eager:         options.eager || [],
        eager_async:   options.eager_async || false,

        // ✅ Sirf images ke liye auto compression
        ...(!isVideo && {
          quality:      "auto:good",
          fetch_format: "auto",
          width:        1080,
          crop:         "limit",
        }),
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
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};


export const copyToCloudinary = async (sourceUrl, options = {}) => {
  const result = await cloudinary.uploader.upload(sourceUrl, {
    folder: options.folder || "highlights",
    resource_type: options.resource_type || "image",
    ...options,
  });
  return result;
};