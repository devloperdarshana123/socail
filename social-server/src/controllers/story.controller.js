// import Story from "../models/Story.js";
// import cloudinary from "../config/cloudinary.js";
// import { Readable } from "stream";

// // Helper - buffer ko Cloudinary pe upload karta hai
// const uploadToCloudinary = (buffer, options) => {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream(
//       options,
//       (error, result) => {
//         if (error) reject(error);
//       const populated = await story.populate("user", "name avatar");
//       }
//     );
//     Readable.from(buffer).pipe(uploadStream);
//   });
// };

// // ── Upload Story ──────────────────────────────────────────────────────────────
// export const uploadStory = async (req, res) => {
//   try {
//     const { mediaType, textContent, textBg } = req.body;

//     if (!mediaType)
//       return res.status(400).json({ success: false, error: "mediaType required" });

//     if (mediaType === "text" && !textContent?.trim())
//       return res.status(400).json({ success: false, error: "Text content required" });

//     if (mediaType !== "text" && !req.file)
//       return res.status(400).json({ success: false, error: "Media file required" });

//     let mediaUrl = "";
//     let mediaPublicId = "";

//     // Text story nahi hai toh Cloudinary pe upload karo
//     if (mediaType !== "text") {
//       const isVideo = mediaType === "video";
//       const result = await uploadToCloudinary(req.file.buffer, {
//         folder: "stories",
//         resource_type: isVideo ? "video" : "image",
//         transformation: isVideo
//           ? [{ quality: "auto" }]
//           : [{ width: 1080, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
//       });
//       mediaUrl = result.secure_url;
//       mediaPublicId = result.public_id;
//     }

//     const story = await Story.create({
//       user: req.user.id,
//       mediaUrl,
//       mediaPublicId,
//       mediaType,
//       textContent: textContent?.trim() || "",
//       textBg: textBg || "#6366f1",
//     });

//     const populated = await story.populate("user", "name avatar");
//     res.status(201).json({ success: true, story: populated });

//   } catch (err) {
//     console.error("uploadStory error:", err);
//     res.status(500).json({ success: false, error: "Story upload failed" });
//   }
// };

// // ── Baaki functions same rahenge ──────────────────────────────────────────────
// export const getStories = async (req, res) => {
//   try {
//     const stories = await Story.find({ expiresAt: { $gt: new Date() } })
//       .populate("user", "username profilePic")
//       .sort({ createdAt: -1 })
//       .lean();

//     const groupedMap = new Map();
//     stories.forEach((story) => {
//       const uid = story.user._id.toString();
//       if (!groupedMap.has(uid)) {
//         groupedMap.set(uid, { user: story.user, stories: [], hasUnread: false });
//       }
//       const group = groupedMap.get(uid);
//       group.stories.push(story);
//       const viewedByMe = story.viewers.some(
//         (v) => v.toString() === req.user.id.toString()
//       );
//       if (!viewedByMe) group.hasUnread = true;
//     });

//     const result = Array.from(groupedMap.values()).sort((a, b) => {
//       if (a.user._id.toString() === req.user.id) return -1;
//       if (b.user._id.toString() === req.user.id) return 1;
//       return b.hasUnread - a.hasUnread;
//     });

//     res.json({ success: true, data: result });
//   } catch (err) {
//     console.error("getStories error:", err);
//     res.status(500).json({ success: false, error: "Failed to fetch stories" });
//   }
// };

// export const markViewed = async (req, res) => {
//   try {
//     const story = await Story.findById(req.params.id);
//     if (!story)
//       return res.status(404).json({ success: false, error: "Story not found" });

//     await Story.findByIdAndUpdate(req.params.id, {
//       $addToSet: { viewers: req.user.id },
//     });
//     res.json({ success: true });
//   } catch (err) {
//     console.error("markViewed error:", err);
//     res.status(500).json({ success: false, error: "Failed to mark as viewed" });
//   }
// };

// export const deleteStory = async (req, res) => {
//   try {
//     const story = await Story.findById(req.params.id);
//     if (!story)
//       return res.status(404).json({ success: false, error: "Story not found" });
//     if (story.user.toString() !== req.user.id)
//       return res.status(403).json({ success: false, error: "Not authorized" });

//     if (story.mediaPublicId) {
//       const resourceType = story.mediaType === "video" ? "video" : "image";
//       await cloudinary.uploader
//         .destroy(story.mediaPublicId, { resource_type: resourceType })
//         .catch((e) => console.error("Cloudinary delete:", e));
//     }

//     await story.deleteOne();
//     res.json({ success: true, message: "Story deleted" });
//   } catch (err) {
//     console.error("deleteStory error:", err);
//     res.status(500).json({ success: false, error: "Failed to delete story" });
//   }
// };

// export const getViewers = async (req, res) => {
//   try {
//     const story = await Story.findById(req.params.id)
//       .populate("viewers", "name avatar");
//     if (!story)
//       return res.status(404).json({ success: false, error: "Story not found" });
//     if (story.user.toString() !== req.user.id)
//       return res.status(403).json({ success: false, error: "Not authorized" });

//     res.json({ success: true, viewers: story.viewers, count: story.viewers.length });
//   } catch (err) {
//     console.error("getViewers error:", err);
//     res.status(500).json({ success: false, error: "Failed to fetch viewers" });
//   }
// };



import Story from "../models/Story.js";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";

// Helper - buffer ko Cloudinary pe upload karta hai
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

// ── Upload Story ──────────────────────────────────────────────────────────────
export const uploadStory = async (req, res) => {
  try {
    const { mediaType, textContent, textBg } = req.body;

    if (!mediaType)
      return res.status(400).json({ success: false, error: "mediaType required" });

    if (mediaType === "text" && !textContent?.trim())
      return res.status(400).json({ success: false, error: "Text content required" });

    if (mediaType !== "text" && !req.file)
      return res.status(400).json({ success: false, error: "Media file required" });

    let mediaUrl = "";
    let mediaPublicId = "";

    if (mediaType !== "text") {
      const isVideo = mediaType === "video";
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "stories",
        resource_type: isVideo ? "video" : "image",
        transformation: isVideo
          ? [{ quality: "auto" }]
          : [{ width: 1080, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
      });
      mediaUrl = result.secure_url;
      mediaPublicId = result.public_id;
    }

    const story = await Story.create({
      user: req.user.id,
      mediaUrl,
      mediaPublicId,
      mediaType,
      textContent: textContent?.trim() || "",
      textBg: textBg || "#6366f1",
    });

    const populated = await story.populate("user", "name avatar");
    res.status(201).json({ success: true, story: populated });

  } catch (err) {
    console.error("uploadStory error:", err);
    res.status(500).json({ success: false, error: "Story upload failed" });
  }
};

// ── Get Stories ───────────────────────────────────────────────────────────────
export const getStories = async (req, res) => {
  try {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 })
      .lean();

    const groupedMap = new Map();
    stories.forEach((story) => {
      const uid = story.user._id.toString();
      if (!groupedMap.has(uid)) {
        groupedMap.set(uid, { user: story.user, stories: [], hasUnread: false });
      }
      const group = groupedMap.get(uid);
      group.stories.push(story);
      const viewedByMe = story.viewers.some(
        (v) => v.toString() === req.user.id.toString()
      );
      if (!viewedByMe) group.hasUnread = true;
    });

    const result = Array.from(groupedMap.values()).sort((a, b) => {
      if (a.user._id.toString() === req.user.id) return -1;
      if (b.user._id.toString() === req.user.id) return 1;
      return b.hasUnread - a.hasUnread;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("getStories error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch stories" });
  }
};

// ── Mark Viewed ───────────────────────────────────────────────────────────────
export const markViewed = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story)
      return res.status(404).json({ success: false, error: "Story not found" });

    await Story.findByIdAndUpdate(req.params.id, {
      $addToSet: { viewers: req.user.id },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("markViewed error:", err);
    res.status(500).json({ success: false, error: "Failed to mark as viewed" });
  }
};

// ── Delete Story ──────────────────────────────────────────────────────────────
export const deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story)
      return res.status(404).json({ success: false, error: "Story not found" });
    if (story.user.toString() !== req.user.id)
      return res.status(403).json({ success: false, error: "Not authorized" });

    if (story.mediaPublicId) {
      const resourceType = story.mediaType === "video" ? "video" : "image";
      await cloudinary.uploader
        .destroy(story.mediaPublicId, { resource_type: resourceType })
        .catch((e) => console.error("Cloudinary delete:", e));
    }

    await story.deleteOne();
    res.json({ success: true, message: "Story deleted" });
  } catch (err) {
    console.error("deleteStory error:", err);
    res.status(500).json({ success: false, error: "Failed to delete story" });
  }
};

// ── Get Viewers ───────────────────────────────────────────────────────────────
export const getViewers = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate("viewers", "name avatar");
    if (!story)
      return res.status(404).json({ success: false, error: "Story not found" });
    if (story.user.toString() !== req.user.id)
      return res.status(403).json({ success: false, error: "Not authorized" });

    res.json({ success: true, viewers: story.viewers, count: story.viewers.length });
  } catch (err) {
    console.error("getViewers error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch viewers" });
  }
};