
// ─── Cloudinary image URL optimize karo (resize + compress + WebP) ───────────
export const optimizeCloudinaryImage = (url, options = {}) => {
  if (!url || !url.includes("res.cloudinary.com")) return url;

  const {
    width   = 400,
    quality = "auto",
    format  = "auto",
    crop    = "fill",
  } = options;

  try {
    if (url.includes("/upload/w_") || url.includes("/upload/f_") || url.includes("/upload/q_")) {
      return url;
    }
    return url.replace(
      "/upload/",
      `/upload/w_${width},c_${crop},f_${format},q_${quality}/`
    );
  } catch {
    return url;
  }
};
// ─── Core: Cloudinary video URL se thumbnail URL generate karo ───────────────
export const generateCloudinaryThumb = (videoUrl, options = {}) => {
  if (!videoUrl || !videoUrl.includes("res.cloudinary.com")) return null;

  const {
    second  = 0,
    width   = 600,
    height  = 600,
    crop    = "fill",
    quality = "auto",
    format  = "jpg",
  } = options;

  try {
    // /upload/ ke baad transformation inject karo
    return videoUrl
      .replace(
        "/upload/",
        `/upload/so_${second},w_${width},h_${height},c_${crop},f_${format},q_${quality}/`
      )
      .replace(/\.(mp4|mov|webm|avi|mkv|m4v)$/i, `.${format}`);
  } catch {
    return null;
  }
};

// ─── Is media item video hai? ─────────────────────────────────────────────────
export const isVideoMedia = (post) => {
  const media = post?.media?.[0];
  return (
    post?.type === "reel" ||
    media?.resourceType === "video" ||
    media?.type === "video" ||
    /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(media?.url || "")
  );
};

// ─── Post grid ke liye thumbnail resolve karo (3-layer fallback) ──────────────
// Layer 1: DB mein saved thumbnailUrl (upload time eager se aaya)
// Layer 2: Cloudinary URL manipulation (runtime, zero cost)
// Layer 3: Raw video URL (browser khud poster frame dikhayega)
// export const resolvePostThumb = (post) => {
//   const media = post?.media?.[0];
//   if (!media?.url) return null;

//   if (!isVideoMedia(post)) {
//     // Image post — seedha URL
//     return media.url;
//   }

//   // Video post — 3-layer fallback
//   return (
//     media.thumbnailUrl ||
//     generateCloudinaryThumb(media.url) ||
//     media.url
//   );
// };

export const resolvePostThumb = (post) => {
  const media = post?.media?.[0];
  if (!media?.url) return null;

  if (!isVideoMedia(post)) {
    return optimizeCloudinaryImage(media.url, { width: 400, quality: "auto", format: "auto" });
  }

  return (
    media.thumbnailUrl ||
    generateCloudinaryThumb(media.url) ||
    media.url
  );
};
// ─── Feed / PostCard ke liye full media array resolve karo ───────────────────
// Har media item mein thumbnailUrl inject karo agar missing hai
export const resolveMediaArray = (mediaArr = [], postType) => {
  return mediaArr.map((item, index) => {
    const itemIsVideo =
      postType === "reel" ||
      item.resourceType === "video" ||
      item.type === "video" ||
      /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(item.url || "");

    if (!itemIsVideo) return item;

    return {
      ...item,
      thumbnailUrl:
        item.thumbnailUrl ||
        generateCloudinaryThumb(item.url) ||
        null,
    };
  });
};

// ─── Story / Highlight ke liye media resolve karo ────────────────────────────
export const resolveStoryThumb = (story) => {
  const media = story?.media;
  if (!media?.url) return null;

  const isVid =
    media.resourceType === "video" ||
    /\.(mp4|mov|webm|avi)$/i.test(media.url);

  if (!isVid) return media.url;

  return (
    media.thumbnailUrl ||
    generateCloudinaryThumb(media.url, { second: 0, width: 400, height: 400 }) ||
    media.url
  );
};

// ─── onError handler — img tag mein use karo ─────────────────────────────────
// <img onError={createImgErrorHandler(post.media?.[0]?.url)} />
export const createImgErrorHandler = (fallbackUrl) => (e) => {
  if (fallbackUrl && e.target.src !== fallbackUrl) {
    e.target.src = fallbackUrl;
  } else {
    e.target.style.display = "none";
    if (e.target.parentNode) {
      e.target.parentNode.style.background = "#e8d5be";
    }
  }
};