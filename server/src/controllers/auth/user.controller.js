

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import prisma from "../../config/prisma.js";
import { Prisma } from "@prisma/client";
import * as UserHelper from "../../utils/userHelpers.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../helper/cloudinaryUpload.js";
import redis from "../../config/redis.js";

const uploadImage = async (buffer, folder, transformation = []) => {
  return uploadToCloudinary(buffer, { folder, resourceType: "image", transformation });
};

export const updateAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError("Please upload an image file.", 400));
  if (req.file.size > 5 * 1024 * 1024) return next(new AppError("Avatar image cannot exceed 5MB.", 400));

  const user = await UserHelper.findById(req.user.id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId, "image").catch(() => {});
  }

  const result = await uploadImage(req.file.buffer, "erovians/avatars", [
    { width: 400, height: 400, crop: "fill", gravity: "face" },
    { quality: "auto:best" },
    { fetch_format: "auto" },
  ]);

  const avatar = { url: result.secure_url, publicId: result.public_id };
  await prisma.user.update({ where: { id: user.id }, data: { avatar } });
  await redis.del(`user:auth:${user.id}`).catch(() => {});

  res.status(200).json({ success: true, message: "Avatar updated successfully.", data: { avatar } });
});

export const updateCoverPhoto = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError("Please upload an image file.", 400));
  if (req.file.size > 10 * 1024 * 1024) return next(new AppError("Cover photo cannot exceed 10MB.", 400));

  const user = await UserHelper.findById(req.user.id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.coverPhoto?.publicId) {
    await deleteFromCloudinary(user.coverPhoto.publicId, "image").catch(() => {});
  }

  const result = await uploadImage(req.file.buffer, "erovians/covers", [
    { width: 1200, height: 400, crop: "fill", gravity: "auto" },
    { quality: "auto:best" },
    { fetch_format: "auto" },
  ]);

  const coverPhoto = { url: result.secure_url, publicId: result.public_id };
  await prisma.user.update({ where: { id: user.id }, data: { coverPhoto } });
  await redis.del(`user:auth:${user.id}`).catch(() => {});

  res.status(200).json({ success: true, message: "Cover photo updated successfully.", data: { coverPhoto } });
});

export const removeAvatar = asyncHandler(async (req, res, next) => {
  const user = await UserHelper.findById(req.user.id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId, "image").catch(() => {});
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatar: { url: null, publicId: null } } });
  await redis.del(`user:auth:${user.id}`).catch(() => {});

  res.status(200).json({ success: true, message: "Avatar removed." });
});

export const removeCoverPhoto = asyncHandler(async (req, res, next) => {
  const user = await UserHelper.findById(req.user.id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.coverPhoto?.publicId) {
    await deleteFromCloudinary(user.coverPhoto.publicId, "image").catch(() => {});
  }

  await prisma.user.update({ where: { id: user.id }, data: { coverPhoto: { url: null, publicId: null } } });
  await redis.del(`user:auth:${user.id}`).catch(() => {});

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
      const query = location.city
  ? [location.city, location.state, location.country || "India"].filter(Boolean).join(", ")
  : [location.state, location.country || "India"].filter(Boolean).join(", ");
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

  const updatedUser = await prisma.user.update({ where: { id: req.user.id }, data: updateFields });
  await redis.del(`user:auth:${req.user.id}`).catch(() => {});

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: UserHelper.toSafeObject(updatedUser),
  });
});

export const getMapSellers = asyncHandler(async (req, res) => {
  const { q, category } = req.query;

  const cacheKey = `map:sellers:${category || "all"}:${q || ""}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.status(200).json({ success: true, users: cached, fromCache: true });
  } catch {}

  const currentUserId = req.user?.id;

  // const baseConditions = [
  //   { accountStatus: "active" },
  //   { role: { not: "super_admin" } },
  //   {
  //     OR: [
  //       { location: { path: ["coordinates", "coordinates"], not: null } },
  //       { location: { path: ["city"], not: null } },
  //     ],
  //   },
  // ];

  const baseConditions = [
  { accountStatus: "active" },
  { role: { not: "super_admin" } },
  {
    NOT: { location: { equals: Prisma.JsonNull } },
  },
];
  if (category && category !== "all") baseConditions.push({ businessCategory: category });

  if (q) {
    if (q.length > 100) return res.status(400).json({ success: false, message: "Search query too long." });
    baseConditions.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { designation: { contains: q, mode: "insensitive" } },
        { businessCategory: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const [users, followingRows] = await Promise.all([
    prisma.user.findMany({
      where: { AND: baseConditions },
      select: {
        id: true, fullName: true, username: true, avatar: true, designation: true,
        businessCategory: true, location: true, followersCount: true,
        isVerifiedBadge: true, isPrivate: true,
      },
      take: 200,
    }),
    currentUserId
      ? prisma.follow.findMany({ where: { followerId: currentUserId, status: "accepted" }, select: { followingId: true } })
      : Promise.resolve([]),
  ]);

  const followingSet = new Set(followingRows.map((f) => f.followingId));
  const usersWithFollowStatus = users.map((u) => ({
    ...u,
    isFollowing: followingSet.has(u.id),
  }));

  try {
    await redis.set(cacheKey, JSON.stringify(usersWithFollowStatus), { ex: 60 });
  } catch {}

  return res.status(200).json({ success: true, users: usersWithFollowStatus });
});

// ── Block / Unblock — ab Block table use karte hain ─────────────────

export const blockUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  if (userId === currentUserId) return next(new AppError("You cannot block yourself.", 400));

  const targetUser = await UserHelper.findById(userId);
  if (!targetUser) return next(new AppError("User not found.", 404));

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: currentUserId, blockedId: userId } },
    update: {},
    create: { blockerId: currentUserId, blockedId: userId },
  });

  res.status(200).json({ success: true, message: "User blocked successfully." });
});

export const unblockUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  await prisma.block.deleteMany({ where: { blockerId: currentUserId, blockedId: userId } });

  res.status(200).json({ success: true, message: "User unblocked successfully." });
});

export const getBlockedUsers = asyncHandler(async (req, res, next) => {
  const blocks = await prisma.block.findMany({
    where: { blockerId: req.user.id },
    include: { blocked: { select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true } } },
  });

  res.status(200).json({ success: true, data: blocks.map((b) => b.blocked) });
});

export const getBlockStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  const them = await UserHelper.findById(userId);
  if (!them) return next(new AppError("User not found.", 404));

  const [iBlockedThemRow, theyBlockedMeRow] = await Promise.all([
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: currentUserId, blockedId: userId } } }),
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: userId, blockedId: currentUserId } } }),
  ]);

  const iBlockedThem = !!iBlockedThemRow;
  const theyBlockedMe = !!theyBlockedMeRow;

  res.status(200).json({
    success: true,
    data: { blocked: iBlockedThem || theyBlockedMe, iBlockedThem, theyBlockedMe },
  });
});

// ── Report — abhi sirf Post report support karta hai (schema limitation) ──

// export const submitReport = asyncHandler(async (req, res, next) => {
//   const { targetId, targetModel, reason, description } = req.body;
//   const reporterId = req.user.id;

//   if (targetModel !== "Post") {
//     return next(new AppError("Currently only Post reports are supported.", 400));
//   }
//   if (!targetId) return next(new AppError("targetId is required.", 400));
//   if (!reason?.trim()) return next(new AppError("Reason is required.", 400));

//   const post = await prisma.post.findUnique({ where: { id: targetId } });
//   if (!post) return next(new AppError("Post not found.", 404));

//   const existing = await prisma.report.findUnique({
//     where: { reportedById_postId: { reportedById: reporterId, postId: targetId } },
//   });
//   if (existing) return next(new AppError("You have already reported this post.", 409));

//   await prisma.report.create({
//     data: {
//       reportedById: reporterId,
//       postId: targetId,
//       targetModel,
//       reason,
//       description: description?.trim() || "",
//     },
//   });

//   res.status(201).json({ success: true, message: "Report submitted. Our team will review it." });
// });