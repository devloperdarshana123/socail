// import asyncHandler from "../../middlewares/asyncHandler.js";
// import AppError from "../../utils/AppError.js";
// import User from "../../models/user.model.js";
// import Follow from "../../models/follow.model.js";
// import Report from "../../models/report.model.js";
// import {
//   uploadToCloudinary,
//   deleteFromCloudinary,
// } from "../../helper/cloudinaryUpload.js";
// import redis from "../../config/redis.js";
// // ─────────────────────────────────────────────
// //  Helper — Multer buffer → Cloudinary
// // ─────────────────────────────────────────────
// const uploadImage = async (buffer, folder, transformation = []) => {
//   return uploadToCloudinary(buffer, {
//     folder,
//     resourceType: "image",
//     transformation,
//   });
// };

// // ─────────────────────────────────────────────
// //  PATCH /api/v2/user/avatar
// //  Upload / replace profile avatar
// // ─────────────────────────────────────────────
// export const updateAvatar = asyncHandler(async (req, res, next) => {
//   if (!req.file) {
//     return next(new AppError("Please upload an image file.", 400));
//   }
//   if (req.file.size > 5 * 1024 * 1024) {
//   return next(new AppError("Avatar image cannot exceed 5MB.", 400));
// }

//   const user = await User.findById(req.user._id);
//   if (!user) return next(new AppError("User not found.", 404));

//   // Delete old avatar from Cloudinary (if exists)
//   if (user.avatar?.publicId) {
//     await deleteFromCloudinary(user.avatar.publicId, "image").catch(() => {});
//   }

//   // Upload new avatar — square crop, face-aware
//   const result = await uploadImage(req.file.buffer, "erovians/avatars", [
//     { width: 400, height: 400, crop: "fill", gravity: "face" },
//     { quality: "auto:best" },
//     { fetch_format: "auto" },
//   ]);

//   user.avatar = {
//     url: result.secure_url,
//     publicId: result.public_id,
//   };

// //   await user.save({ validateBeforeSave: false });

// //   res.status(200).json({
// //     success: true,
// //     message: "Avatar updated successfully.",
// //     data: {
// //       avatar: user.avatar,
// //     },
// //   });
// // });
// await user.save({ validateBeforeSave: false });
// await redis.del(`user:auth:${user._id}`).catch(() => {}); // ← ADD

// res.status(200).json({
//   success: true,
//   message: "Avatar updated successfully.",
//   data: {
//     avatar: user.avatar,
//   },
// });
// // ─────────────────────────────────────────────
// //  PATCH /api/v2/user/cover-photo
// //  Upload / replace cover photo
// // ─────────────────────────────────────────────
// export const updateCoverPhoto = asyncHandler(async (req, res, next) => {
//   if (!req.file) {
//     return next(new AppError("Please upload an image file.", 400));
//   }

//   if (req.file.size > 10 * 1024 * 1024) {
//   return next(new AppError("Cover photo cannot exceed 10MB.", 400));
// }
//   const user = await User.findById(req.user._id);
//   if (!user) return next(new AppError("User not found.", 404));

//   // Delete old cover from Cloudinary (if exists)
//   if (user.coverPhoto?.publicId) {
//     await deleteFromCloudinary(user.coverPhoto.publicId, "image").catch(
//       () => {}
//     );
//   }

//   // Upload new cover — wide banner crop
//   const result = await uploadImage(req.file.buffer, "erovians/covers", [
//     { width: 1200, height: 400, crop: "fill", gravity: "auto" },
//     { quality: "auto:best" },
//     { fetch_format: "auto" },
//   ]);

//   user.coverPhoto = {
//     url: result.secure_url,
//     publicId: result.public_id,
//   };

// //   await user.save({ validateBeforeSave: false });

// //   res.status(200).json({
// //     success: true,
// //     message: "Cover photo updated successfully.",
// //     data: {
// //       coverPhoto: user.coverPhoto,
// //     },
// //   });
// // });
// await user.save({ validateBeforeSave: false });
// await redis.del(`user:auth:${user._id}`).catch(() => {}); // ← ADD

// res.status(200).json({
//   success: true,
//   message: "Cover photo updated successfully.",
//   data: {
//     coverPhoto: user.coverPhoto,
//   },
// });
// // ─────────────────────────────────────────────
// //  DELETE /api/v2/user/avatar
// //  Remove avatar → reset to null
// // ─────────────────────────────────────────────
// export const removeAvatar = asyncHandler(async (req, res, next) => {
//   const user = await User.findById(req.user._id);
//   if (!user) return next(new AppError("User not found.", 404));

//   if (user.avatar?.publicId) {
//     await deleteFromCloudinary(user.avatar.publicId, "image").catch(() => {});
//   }

//   user.avatar = { url: null, publicId: null };
// //   await user.save({ validateBeforeSave: false });

// //   res.status(200).json({
// //     success: true,
// //     message: "Avatar removed.",
// //   });
// // });
// await user.save({ validateBeforeSave: false });
// await redis.del(`user:auth:${user._id}`).catch(() => {}); // ← ADD

// res.status(200).json({
//   success: true,
//   message: "Avatar removed.",
// });
// // ─────────────────────────────────────────────
// //  DELETE /api/v2/user/cover-photo
// //  Remove cover photo → reset to null
// // ─────────────────────────────────────────────
// export const removeCoverPhoto = asyncHandler(async (req, res, next) => {
//   const user = await User.findById(req.user._id);
//   if (!user) return next(new AppError("User not found.", 404));

//   if (user.coverPhoto?.publicId) {
//     await deleteFromCloudinary(user.coverPhoto.publicId, "image").catch(
//       () => {}
//     );
//   }

//   user.coverPhoto = { url: null, publicId: null };
// //   await user.save({ validateBeforeSave: false });

// //   res.status(200).json({
// //     success: true,
// //     message: "Cover photo removed.",
// //   });
// // });
// await user.save({ validateBeforeSave: false });
// await redis.del(`user:auth:${user._id}`).catch(() => {}); // ← ADD

// res.status(200).json({
//   success: true,
//   message: "Cover photo removed.",
// });

// export const updateProfile = asyncHandler(async (req, res, next) => {
//   const { fullName, bio, designation, dateOfBirth, gender, website, businessCategory, location  } = req.body;

//   const updateFields = {};


// if (fullName !== undefined) {
//   if (fullName.trim().length < 2 || fullName.trim().length > 50) {
//     return next(new AppError("Full name must be between 2 and 50 characters.", 400));
//   }
//   updateFields.fullName = fullName.trim();
// }
// if (bio !== undefined) {
//   if (bio.length > 300) {
//     return next(new AppError("Bio cannot exceed 300 characters.", 400));
//   }
//   updateFields.bio = bio;
// }
//   if (designation !== undefined) updateFields.designation = designation;
//   if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth || null;
//   if (gender      !== undefined) updateFields.gender      = gender || null;
//   if (website     !== undefined) updateFields.website     = website || null;
//   if (businessCategory !== undefined) updateFields.businessCategory = businessCategory || null;
//   if (location         !== undefined) updateFields.location         = location || null;
//   // location ke baad yeh add karo:
// if (location?.city || location?.state) {
//   try {
//     const query = [location.city, location.state, location.country || "India"]
//       .filter(Boolean).join(", ");
//     const geoRes = await fetch(
//       `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
//       { headers: { "User-Agent": "Erovians/1.0" } }
//     );
//     const geoData = await geoRes.json();
//     if (geoData?.[0]) {
//       updateFields.location = {
//         ...location,
//         coordinates: {
//           type: "Point",
//           coordinates: [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)],
//         },
//       };
//     }
//   } catch {
//     // Geocoding fail — sirf city/state save karo, coordinates baad mein
//   }
// }

//   // ✅ Pehle update karo, phir fresh fetch karo — toSafeObject() ke liye
//   await User.findByIdAndUpdate(
//     req.user._id,
//     { $set: updateFields },
//     { runValidators: true }
//   );

//   const updatedUser = await User.findById(req.user._id);
//   if (!updatedUser) return next(new AppError("User not found.", 404));

//   res.status(200).json({
//     success: true,
//     message: "Profile updated successfully.",
//     data: updatedUser.toSafeObject(),  // ✅ Ab proper Mongoose instance hai
//   });
// });



// // ─────────────────────────────────────────────
// //  GET /api/v2/users/map-sellers
// //  Map pe real sellers dikhao
// // ─────────────────────────────────────────────
// export const getMapSellers = asyncHandler(async (req, res) => {
//   const { q, category } = req.query;  // ← PEHLE destructure karo

//   // ── Cache check (60s) ──
//   const cacheKey = `map:sellers:${category || "all"}:${q || ""}`;
//   try {
//     const cached = await redis.get(cacheKey);
//     if (cached) {
//       return res.status(200).json({ success: true, users: cached, fromCache: true });
//     }
//   } catch { /* Redis down — DB se serve karo */ }
//   const currentUserId = req.user?._id;

// // NAYA
// const filter = {
//   accountStatus: "active",
//   role: { $ne: "super_admin" },   // ← YE ADD KARO
//   $or: [
//     { "location.coordinates.coordinates": { $exists: true, $size: 2 } },
//     { "location.city": { $exists: true, $ne: null } },
//   ],
// };

//   if (category && category !== "all") {
//     filter.businessCategory = category;
//   }

// if (q) {
//   if (q.length > 100) {
//     return res.status(400).json({ success: false, message: "Search query too long." });
//   }
//   const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//   filter.$or = [
//     { fullName:         { $regex: safeQ, $options: "i" } },
//     { designation:      { $regex: safeQ, $options: "i" } },
//     { "location.city":  { $regex: safeQ, $options: "i" } },
//     { businessCategory: { $regex: safeQ, $options: "i" } },
//   ];
// }

//   // ── Fetch users + follow status parallel ─────────────────
//   const [users, followingIds] = await Promise.all([
//     User.find(filter)
//       .select("fullName username avatar designation businessCategory location followersCount isVerifiedBadge isPrivate")
//       .limit(200)
//       .lean(), // ✅ lean() — plain JS object, faster
//     currentUserId
//       ? Follow.find({ follower: currentUserId, status: "accepted" }).distinct("following")
//       : Promise.resolve([]),
//   ]);

//   // ── isFollowing set banao O(1) lookup ke liye ────────────
//   const followingSet = new Set(followingIds.map((id) => id.toString()));

//   // ── Response ──────────────────────────────────────────────
//   const usersWithFollowStatus = users.map((u) => ({
//     ...u,
//     isFollowing: followingSet.has(u._id.toString()),
//   }));

// // Cache set — 60s TTL
//   try {
//     await redis.set(cacheKey, JSON.stringify(usersWithFollowStatus), { ex: 60 });
//   } catch { /* ignore */ }

//   return res.status(200).json({
//     success: true,
//     users: usersWithFollowStatus,
//   });
// });

// // ── POST /api/v2/user/block/:userId ──

// // ─────────────────────────────────────────────
// //  POST /api/v2/user/block/:userId
// //  Block a user
// // ─────────────────────────────────────────────
// export const blockUser = asyncHandler(async (req, res, next) => {
//   const { userId } = req.params;
//   const currentUserId = req.user._id;

//   if (userId === currentUserId.toString()) {
//     return next(new AppError("You cannot block yourself.", 400));
//   }

//   const targetUser = await User.findById(userId);
//   if (!targetUser) return next(new AppError("User not found.", 404));

//   await User.findByIdAndUpdate(currentUserId, {
//     $addToSet: { blockedUsers: userId }, // duplicate nahi aayega
//   });

//   res.status(200).json({
//     success: true,
//     message: "User blocked successfully.",
//   });
// });

// // ─────────────────────────────────────────────
// //  DELETE /api/v2/user/block/:userId
// //  Unblock a user
// // ─────────────────────────────────────────────
// export const unblockUser = asyncHandler(async (req, res, next) => {
//   const { userId } = req.params;
//   const currentUserId = req.user._id;

//   await User.findByIdAndUpdate(currentUserId, {
//     $pull: { blockedUsers: userId },
//   });

//   res.status(200).json({
//     success: true,
//     message: "User unblocked successfully.",
//   });
// });

// // ─────────────────────────────────────────────
// //  GET /api/v2/user/blocked
// //  Get my blocked users list
// // ─────────────────────────────────────────────
// export const getBlockedUsers = asyncHandler(async (req, res, next) => {
//   const user = await User.findById(req.user._id)
//     .populate("blockedUsers", "username fullName avatar isVerifiedBadge");

//   res.status(200).json({
//     success: true,
//     data: user.blockedUsers || [],
//   });
// });

// // ─────────────────────────────────────────────
// //  GET /api/v2/user/block-status/:userId
// //  Check if blocked (either direction)
// // ─────────────────────────────────────────────
// export const getBlockStatus = asyncHandler(async (req, res, next) => {
//   const { userId } = req.params;
//   const currentUserId = req.user._id;

//   const [me, them] = await Promise.all([
//     User.findById(currentUserId).select("blockedUsers").lean(),
//     User.findById(userId).select("blockedUsers").lean(),
//   ]);

//   if (!them) return next(new AppError("User not found.", 404));

//   const iBlockedThem = me?.blockedUsers?.map(String).includes(String(userId)) ?? false;
//   const theyBlockedMe = them?.blockedUsers?.map(String).includes(String(currentUserId)) ?? false;

//   res.status(200).json({
//     success: true,
//     data: {
//       blocked: iBlockedThem || theyBlockedMe,
//       iBlockedThem,
//       theyBlockedMe,
//     },
//   });
// });


// export const submitReport = asyncHandler(async (req, res, next) => {
//   const { targetId, targetModel, reason, description } = req.body;
//   const reporterId = req.user._id;

//   // ── Validate targetModel ──────────────────────────────────
//   const ALLOWED_MODELS = ["User", "Post", "Comment"];
//   if (!ALLOWED_MODELS.includes(targetModel)) {
//     return next(new AppError("Invalid target type.", 400));
//   }

//   // ── Validate targetId ─────────────────────────────────────
//   if (!targetId) return next(new AppError("targetId is required.", 400));
//   if (!reason?.trim()) return next(new AppError("Reason is required.", 400));

//   // ── Self-report guard (only for User) ─────────────────────
//   if (targetModel === "User" && String(targetId) === String(reporterId)) {
//     return next(new AppError("You cannot report yourself.", 400));
//   }

//   // ── Target existence check ────────────────────────────────
//   let targetExists = false;
//   if (targetModel === "User") {
//     targetExists = !!(await User.exists({ _id: targetId }));
//   } else if (targetModel === "Post") {
//     const Post = (await import("../../models/post.model.js")).default;
//     targetExists = !!(await Post.exists({ _id: targetId }));
//   } else if (targetModel === "Comment") {
//     const Comment = (await import("../../models/comment.model.js")).default;
//     targetExists = !!(await Comment.exists({ _id: targetId }));
//   }

//   if (!targetExists) {
//     return next(new AppError(`${targetModel} not found.`, 404));
//   }

//   // ── Submit ────────────────────────────────────────────────
//   const { alreadyReported } = await Report.submitReport({
//     reportedBy:  reporterId,
//     targetId,
//     targetModel,
//     reason,
//     description: description?.trim() || "",
//   });

//   if (alreadyReported) {
//     return next(new AppError(`You have already reported this ${targetModel.toLowerCase()}.`, 409));
//   }

//  res.status(201).json({
//     success: true,
//     message: "Report submitted. Our team will review it.",
//   });
// });


import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
import Follow from "../../models/follow.model.js";
import Report from "../../models/report.model.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../helper/cloudinaryUpload.js";
import redis from "../../config/redis.js";

const uploadImage = async (buffer, folder, transformation = []) => {
  return uploadToCloudinary(buffer, {
    folder,
    resourceType: "image",
    transformation,
  });
};

export const updateAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError("Please upload an image file.", 400));
  if (req.file.size > 5 * 1024 * 1024) return next(new AppError("Avatar image cannot exceed 5MB.", 400));

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId, "image").catch(() => {});
  }

  const result = await uploadImage(req.file.buffer, "erovians/avatars", [
    { width: 400, height: 400, crop: "fill", gravity: "face" },
    { quality: "auto:best" },
    { fetch_format: "auto" },
  ]);

  user.avatar = { url: result.secure_url, publicId: result.public_id };
  await user.save({ validateBeforeSave: false });
  await redis.del(`user:auth:${user._id}`).catch(() => {});

  res.status(200).json({
    success: true,
    message: "Avatar updated successfully.",
    data: { avatar: user.avatar },
  });
});

export const updateCoverPhoto = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError("Please upload an image file.", 400));
  if (req.file.size > 10 * 1024 * 1024) return next(new AppError("Cover photo cannot exceed 10MB.", 400));

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.coverPhoto?.publicId) {
    await deleteFromCloudinary(user.coverPhoto.publicId, "image").catch(() => {});
  }

  const result = await uploadImage(req.file.buffer, "erovians/covers", [
    { width: 1200, height: 400, crop: "fill", gravity: "auto" },
    { quality: "auto:best" },
    { fetch_format: "auto" },
  ]);

  user.coverPhoto = { url: result.secure_url, publicId: result.public_id };
  await user.save({ validateBeforeSave: false });
  await redis.del(`user:auth:${user._id}`).catch(() => {});

  res.status(200).json({
    success: true,
    message: "Cover photo updated successfully.",
    data: { coverPhoto: user.coverPhoto },
  });
});

export const removeAvatar = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId, "image").catch(() => {});
  }

  user.avatar = { url: null, publicId: null };
  await user.save({ validateBeforeSave: false });
  await redis.del(`user:auth:${user._id}`).catch(() => {});

  res.status(200).json({ success: true, message: "Avatar removed." });
});

export const removeCoverPhoto = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.coverPhoto?.publicId) {
    await deleteFromCloudinary(user.coverPhoto.publicId, "image").catch(() => {});
  }

  user.coverPhoto = { url: null, publicId: null };
  await user.save({ validateBeforeSave: false });
  await redis.del(`user:auth:${user._id}`).catch(() => {});

  res.status(200).json({ success: true, message: "Cover photo removed." });
});

export const updateProfile = asyncHandler(async (req, res, next) => {
  const { fullName, bio, designation, dateOfBirth, gender, website, businessCategory, location } = req.body;

  const updateFields = {};

  if (fullName !== undefined) {
    if (fullName.trim().length < 2 || fullName.trim().length > 50) {
      return next(new AppError("Full name must be between 2 and 50 characters.", 400));
    }
    updateFields.fullName = fullName.trim();
  }
  if (bio !== undefined) {
    if (bio.length > 300) return next(new AppError("Bio cannot exceed 300 characters.", 400));
    updateFields.bio = bio;
  }
  if (designation !== undefined) updateFields.designation = designation;
  if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth || null;
  if (gender !== undefined) updateFields.gender = gender || null;
  if (website !== undefined) updateFields.website = website || null;
  if (businessCategory !== undefined) updateFields.businessCategory = businessCategory || null;
  if (location !== undefined) updateFields.location = location || null;

  if (location?.city || location?.state) {
    try {
      const query = [location.city, location.state, location.country || "India"].filter(Boolean).join(", ");
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { "User-Agent": "Erovians/1.0" } }
      );
      const geoData = await geoRes.json();
      if (geoData?.[0]) {
        updateFields.location = {
          ...location,
          coordinates: {
            type: "Point",
            coordinates: [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)],
          },
        };
      }
    } catch {}
  }

  await User.findByIdAndUpdate(req.user._id, { $set: updateFields }, { runValidators: true });
  await redis.del(`user:auth:${req.user._id}`).catch(() => {});

  const updatedUser = await User.findById(req.user._id);
  if (!updatedUser) return next(new AppError("User not found.", 404));

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: updatedUser.toSafeObject(),
  });
});

export const getMapSellers = asyncHandler(async (req, res) => {
  const { q, category } = req.query;

  const cacheKey = `map:sellers:${category || "all"}:${q || ""}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, users: cached, fromCache: true });
  } catch {}

  const currentUserId = req.user?._id;

  const filter = {
    accountStatus: "active",
    role: { $ne: "super_admin" },
    $or: [
      { "location.coordinates.coordinates": { $exists: true, $size: 2 } },
      { "location.city": { $exists: true, $ne: null } },
    ],
  };

  if (category && category !== "all") filter.businessCategory = category;

  if (q) {
    if (q.length > 100) return res.status(400).json({ success: false, message: "Search query too long." });
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { fullName: { $regex: safeQ, $options: "i" } },
      { designation: { $regex: safeQ, $options: "i" } },
      { "location.city": { $regex: safeQ, $options: "i" } },
      { businessCategory: { $regex: safeQ, $options: "i" } },
    ];
  }

  const [users, followingIds] = await Promise.all([
    User.find(filter)
      .select("fullName username avatar designation businessCategory location followersCount isVerifiedBadge isPrivate")
      .limit(200)
      .lean(),
    currentUserId
      ? Follow.find({ follower: currentUserId, status: "accepted" }).distinct("following")
      : Promise.resolve([]),
  ]);

  const followingSet = new Set(followingIds.map((id) => id.toString()));
  const usersWithFollowStatus = users.map((u) => ({
    ...u,
    isFollowing: followingSet.has(u._id.toString()),
  }));

  try {
    await redis.set(cacheKey, JSON.stringify(usersWithFollowStatus), { ex: 60 });
  } catch {}

  return res.status(200).json({ success: true, users: usersWithFollowStatus });
});

export const blockUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  if (userId === currentUserId.toString()) return next(new AppError("You cannot block yourself.", 400));

  const targetUser = await User.findById(userId);
  if (!targetUser) return next(new AppError("User not found.", 404));

  await User.findByIdAndUpdate(currentUserId, { $addToSet: { blockedUsers: userId } });

  res.status(200).json({ success: true, message: "User blocked successfully." });
});

export const unblockUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  await User.findByIdAndUpdate(currentUserId, { $pull: { blockedUsers: userId } });

  res.status(200).json({ success: true, message: "User unblocked successfully." });
});

export const getBlockedUsers = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .populate("blockedUsers", "username fullName avatar isVerifiedBadge");

  res.status(200).json({ success: true, data: user.blockedUsers || [] });
});

export const getBlockStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  const [me, them] = await Promise.all([
    User.findById(currentUserId).select("blockedUsers").lean(),
    User.findById(userId).select("blockedUsers").lean(),
  ]);

  if (!them) return next(new AppError("User not found.", 404));

  const iBlockedThem = me?.blockedUsers?.map(String).includes(String(userId)) ?? false;
  const theyBlockedMe = them?.blockedUsers?.map(String).includes(String(currentUserId)) ?? false;

  res.status(200).json({
    success: true,
    data: { blocked: iBlockedThem || theyBlockedMe, iBlockedThem, theyBlockedMe },
  });
});

export const submitReport = asyncHandler(async (req, res, next) => {
  const { targetId, targetModel, reason, description } = req.body;
  const reporterId = req.user._id;

  const ALLOWED_MODELS = ["User", "Post", "Comment"];
  if (!ALLOWED_MODELS.includes(targetModel)) return next(new AppError("Invalid target type.", 400));
  if (!targetId) return next(new AppError("targetId is required.", 400));
  if (!reason?.trim()) return next(new AppError("Reason is required.", 400));

  if (targetModel === "User" && String(targetId) === String(reporterId)) {
    return next(new AppError("You cannot report yourself.", 400));
  }

  let targetExists = false;
  if (targetModel === "User") {
    targetExists = !!(await User.exists({ _id: targetId }));
  } else if (targetModel === "Post") {
    const Post = (await import("../../models/post.model.js")).default;
    targetExists = !!(await Post.exists({ _id: targetId }));
  } else if (targetModel === "Comment") {
    const Comment = (await import("../../models/comment.model.js")).default;
    targetExists = !!(await Comment.exists({ _id: targetId }));
  }

  if (!targetExists) return next(new AppError(`${targetModel} not found.`, 404));

  const { alreadyReported } = await Report.submitReport({
    reportedBy: reporterId,
    targetId,
    targetModel,
    reason,
    description: description?.trim() || "",
  });

  if (alreadyReported) {
    return next(new AppError(`You have already reported this ${targetModel.toLowerCase()}.`, 409));
  }

  res.status(201).json({ success: true, message: "Report submitted. Our team will review it." });
});