// // import Story from "../models/Story.js";
// // import cloudinary from "../config/cloudinary.js";
// // import { Readable } from "stream";

// // // Helper - buffer ko Cloudinary pe upload karta hai
// // const uploadToCloudinary = (buffer, options) => {
// //   return new Promise((resolve, reject) => {
// //     const uploadStream = cloudinary.uploader.upload_stream(
// //       options,
// //       (error, result) => {
// //         if (error) reject(error);
// //       const populated = await story.populate("user", "name avatar");
// //       }
// //     );
// //     Readable.from(buffer).pipe(uploadStream);
// //   });
// // };

// // // ── Upload Story ──────────────────────────────────────────────────────────────
// // export const uploadStory = async (req, res) => {
// //   try {
// //     const { mediaType, textContent, textBg } = req.body;

// //     if (!mediaType)
// //       return res.status(400).json({ success: false, error: "mediaType required" });

// //     if (mediaType === "text" && !textContent?.trim())
// //       return res.status(400).json({ success: false, error: "Text content required" });

// //     if (mediaType !== "text" && !req.file)
// //       return res.status(400).json({ success: false, error: "Media file required" });

// //     let mediaUrl = "";
// //     let mediaPublicId = "";

// //     // Text story nahi hai toh Cloudinary pe upload karo
// //     if (mediaType !== "text") {
// //       const isVideo = mediaType === "video";
// //       const result = await uploadToCloudinary(req.file.buffer, {
// //         folder: "stories",
// //         resource_type: isVideo ? "video" : "image",
// //         transformation: isVideo
// //           ? [{ quality: "auto" }]
// //           : [{ width: 1080, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
// //       });
// //       mediaUrl = result.secure_url;
// //       mediaPublicId = result.public_id;
// //     }

// //     const story = await Story.create({
// //       user: req.user.id,
// //       mediaUrl,
// //       mediaPublicId,
// //       mediaType,
// //       textContent: textContent?.trim() || "",
// //       textBg: textBg || "#6366f1",
// //     });

// //     const populated = await story.populate("user", "name avatar");
// //     res.status(201).json({ success: true, story: populated });

// //   } catch (err) {
// //     console.error("uploadStory error:", err);
// //     res.status(500).json({ success: false, error: "Story upload failed" });
// //   }
// // };

// // // ── Baaki functions same rahenge ──────────────────────────────────────────────
// // export const getStories = async (req, res) => {
// //   try {
// //     const stories = await Story.find({ expiresAt: { $gt: new Date() } })
// //       .populate("user", "username profilePic")
// //       .sort({ createdAt: -1 })
// //       .lean();

// //     const groupedMap = new Map();
// //     stories.forEach((story) => {
// //       const uid = story.user._id.toString();
// //       if (!groupedMap.has(uid)) {
// //         groupedMap.set(uid, { user: story.user, stories: [], hasUnread: false });
// //       }
// //       const group = groupedMap.get(uid);
// //       group.stories.push(story);
// //       const viewedByMe = story.viewers.some(
// //         (v) => v.toString() === req.user.id.toString()
// //       );
// //       if (!viewedByMe) group.hasUnread = true;
// //     });

// //     const result = Array.from(groupedMap.values()).sort((a, b) => {
// //       if (a.user._id.toString() === req.user.id) return -1;
// //       if (b.user._id.toString() === req.user.id) return 1;
// //       return b.hasUnread - a.hasUnread;
// //     });

// //     res.json({ success: true, data: result });
// //   } catch (err) {
// //     console.error("getStories error:", err);
// //     res.status(500).json({ success: false, error: "Failed to fetch stories" });
// //   }
// // };

// // export const markViewed = async (req, res) => {
// //   try {
// //     const story = await Story.findById(req.params.id);
// //     if (!story)
// //       return res.status(404).json({ success: false, error: "Story not found" });

// //     await Story.findByIdAndUpdate(req.params.id, {
// //       $addToSet: { viewers: req.user.id },
// //     });
// //     res.json({ success: true });
// //   } catch (err) {
// //     console.error("markViewed error:", err);
// //     res.status(500).json({ success: false, error: "Failed to mark as viewed" });
// //   }
// // };

// // export const deleteStory = async (req, res) => {
// //   try {
// //     const story = await Story.findById(req.params.id);
// //     if (!story)
// //       return res.status(404).json({ success: false, error: "Story not found" });
// //     if (story.user.toString() !== req.user.id)
// //       return res.status(403).json({ success: false, error: "Not authorized" });

// //     if (story.mediaPublicId) {
// //       const resourceType = story.mediaType === "video" ? "video" : "image";
// //       await cloudinary.uploader
// //         .destroy(story.mediaPublicId, { resource_type: resourceType })
// //         .catch((e) => console.error("Cloudinary delete:", e));
// //     }

// //     await story.deleteOne();
// //     res.json({ success: true, message: "Story deleted" });
// //   } catch (err) {
// //     console.error("deleteStory error:", err);
// //     res.status(500).json({ success: false, error: "Failed to delete story" });
// //   }
// // };

// // export const getViewers = async (req, res) => {
// //   try {
// //     const story = await Story.findById(req.params.id)
// //       .populate("viewers", "name avatar");
// //     if (!story)
// //       return res.status(404).json({ success: false, error: "Story not found" });
// //     if (story.user.toString() !== req.user.id)
// //       return res.status(403).json({ success: false, error: "Not authorized" });

// //     res.json({ success: true, viewers: story.viewers, count: story.viewers.length });
// //   } catch (err) {
// //     console.error("getViewers error:", err);
// //     res.status(500).json({ success: false, error: "Failed to fetch viewers" });
// //   }
// // };



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
//         else resolve(result);
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

// // ── Get Stories ───────────────────────────────────────────────────────────────
// export const getStories = async (req, res) => {
//   try {
//     const stories = await Story.find({ expiresAt: { $gt: new Date() } })
//       .populate("user", "name avatar")
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

// // ── Mark Viewed ───────────────────────────────────────────────────────────────
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

// // ── Delete Story ──────────────────────────────────────────────────────────────
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

// // ── Get Viewers ───────────────────────────────────────────────────────────────
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
import SocialUser from "../models/User.model.js";
import cloudinary from "../config/cloudinary.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("Cloudinary delete:", err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Create Story
// ─────────────────────────────────────────────────────────────────────────────

export const createStory = async (req, res) => {
  try {
    const { textContent, textBg, textColor, visibility } = req.body;
    const file = req.file;

    // Text story ya media story hona chahiye
    if (!file && !textContent?.trim()) {
      return res.status(400).json({ message: "Media ya text content zaroori hai" });
    }

    let mediaUrl      = "";
    let mediaPublicId = "";
    let mediaType     = "text";

    if (file) {
      const isVideo      = file.mimetype.startsWith("video/");
      const resourceType = isVideo ? "video" : "image";
      mediaType          = isVideo ? "video" : "image";

      // Video max 30 seconds
      const result = await uploadBuffer(file.buffer, {
        folder:        "social/stories",
        resource_type: resourceType,
        quality:       "auto",
        fetch_format:  isVideo ? undefined : "auto",
        ...(isVideo && { video_codec: "auto", duration: 30 }),
      });

      mediaUrl      = result.secure_url;
      mediaPublicId = result.public_id;
    }

    const story = await Story.create({
      user:        req.user._id,
      mediaUrl,
      mediaPublicId,
      mediaType,
      textContent: textContent?.trim() || "",
      textBg:      textBg   || "#6366f1",
      textColor:   textColor || "#ffffff",
      visibility:  visibility || "public",
    });

    await story.populate("user", "name username avatar");

    return res.status(201).json({ message: "Story post ho gayi!", story });
  } catch (err) {
    console.error("createStory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Feed Stories (grouped by user)
// ─────────────────────────────────────────────────────────────────────────────

export const getFeedStories = async (req, res) => {
  try {
    const currentUser = await SocialUser.findById(req.user._id).select("following blockedUsers");
    const followingIds = [req.user._id, ...currentUser.following];

    const stories = await Story.find({
      user:      { $in: followingIds, $nin: currentUser.blockedUsers || [] },
      expiresAt: { $gt: new Date() },
      hiddenFrom:{ $nin: [req.user._id] },
      $or: [
        { visibility: "public" },
        { visibility: "followers" },
        { user: req.user._id },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("user", "name username avatar")
      .lean();

    // User ke hisaab se group karo
    const grouped = {};
    for (const story of stories) {
      const uid = story.user._id.toString();
      if (!grouped[uid]) {
        grouped[uid] = {
          user:         story.user,
          stories:      [],
          hasUnwatched: false,
        };
      }

      const watched = story.viewers?.some(
        (v) => v.user?.toString() === req.user._id.toString()
      );

      grouped[uid].stories.push({ ...story, watched });
      if (!watched) grouped[uid].hasUnwatched = true;
    }

    // Apni stories pehle, baaki ke baad
    const result = Object.values(grouped).sort((a, b) => {
      const aSelf = a.user._id.toString() === req.user._id.toString();
      const bSelf = b.user._id.toString() === req.user._id.toString();
      if (aSelf) return -1;
      if (bSelf) return 1;
      // Unwatched pehle
      return b.hasUnwatched - a.hasUnwatched;
    });

    return res.json({ stories: result });
  } catch (err) {
    console.error("getFeedStories error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Mark Story as Viewed
// ─────────────────────────────────────────────────────────────────────────────

export const markViewed = async (req, res) => {
  try {
    const story = await Story.findOne({
      _id:       req.params.storyId,
      expiresAt: { $gt: new Date() },
    });

    if (!story) return res.status(404).json({ message: "Story nahi mili ya expire ho gayi" });

    // Apni story ka view mat count karo
    if (story.user.toString() !== req.user._id.toString()) {
      await story.addViewer(req.user._id);
    }

    return res.json({ message: "Viewed" });
  } catch (err) {
    console.error("markViewed error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Story Viewers (sirf story owner dekh sakta hai)
// ─────────────────────────────────────────────────────────────────────────────

export const getViewers = async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId)
      .populate("viewers.user", "name username avatar");

    if (!story) return res.status(404).json({ message: "Story nahi mili" });

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Sirf aap hi apne story viewers dekh sakte ho" });
    }

    return res.json({
      viewers:     story.viewers,
      viewerCount: story.viewerCount,
    });
  } catch (err) {
    console.error("getViewers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// React to Story
// ─────────────────────────────────────────────────────────────────────────────

export const reactToStory = async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: "Emoji do" });

    const story = await Story.findOne({
      _id:       req.params.storyId,
      expiresAt: { $gt: new Date() },
    });

    if (!story) return res.status(404).json({ message: "Story nahi mili" });

    await story.addReaction(req.user._id, emoji);

    return res.json({ message: "Reaction add ho gaya", reactionsCount: story.reactionsCount });
  } catch (err) {
    console.error("reactToStory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete Story
// ─────────────────────────────────────────────────────────────────────────────

export const deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    if (!story) return res.status(404).json({ message: "Story nahi mili" });

    if (
      story.user.toString() !== req.user._id.toString() &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res.status(403).json({ message: "Delete karne ka permission nahi" });
    }

    // Cloudinary se media delete karo
    if (story.mediaPublicId) {
      await deleteFromCloudinary(
        story.mediaPublicId,
        story.mediaType === "video" ? "video" : "image"
      );
    }

    await Story.findByIdAndDelete(story._id);

    return res.json({ message: "Story delete ho gayi" });
  } catch (err) {
    console.error("deleteStory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Hide Story from specific user
// ─────────────────────────────────────────────────────────────────────────────

export const hideStoryFrom = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId do" });

    await Story.updateMany(
      { user: req.user._id, expiresAt: { $gt: new Date() } },
      { $addToSet: { hiddenFrom: userId } }
    );

    return res.json({ message: "Story us user se hide ho gayi" });
  } catch (err) {
    console.error("hideStoryFrom error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};