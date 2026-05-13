import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../helper/cloudinaryUpload.js";

// ─────────────────────────────────────────────
//  Helper — Multer buffer → Cloudinary
// ─────────────────────────────────────────────
const uploadImage = async (buffer, folder, transformation = []) => {
  return uploadToCloudinary(buffer, {
    folder,
    resourceType: "image",
    transformation,
  });
};

// ─────────────────────────────────────────────
//  PATCH /api/v2/user/avatar
//  Upload / replace profile avatar
// ─────────────────────────────────────────────
export const updateAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Please upload an image file.", 400));
  }

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  // Delete old avatar from Cloudinary (if exists)
  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId, "image").catch(() => {});
  }

  // Upload new avatar — square crop, face-aware
  const result = await uploadImage(req.file.buffer, "erovians/avatars", [
    { width: 400, height: 400, crop: "fill", gravity: "face" },
    { quality: "auto:best" },
    { fetch_format: "auto" },
  ]);

  user.avatar = {
    url: result.secure_url,
    publicId: result.public_id,
  };

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Avatar updated successfully.",
    data: {
      avatar: user.avatar,
    },
  });
});

// ─────────────────────────────────────────────
//  PATCH /api/v2/user/cover-photo
//  Upload / replace cover photo
// ─────────────────────────────────────────────
export const updateCoverPhoto = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Please upload an image file.", 400));
  }

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  // Delete old cover from Cloudinary (if exists)
  if (user.coverPhoto?.publicId) {
    await deleteFromCloudinary(user.coverPhoto.publicId, "image").catch(
      () => {}
    );
  }

  // Upload new cover — wide banner crop
  const result = await uploadImage(req.file.buffer, "erovians/covers", [
    { width: 1200, height: 400, crop: "fill", gravity: "auto" },
    { quality: "auto:best" },
    { fetch_format: "auto" },
  ]);

  user.coverPhoto = {
    url: result.secure_url,
    publicId: result.public_id,
  };

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Cover photo updated successfully.",
    data: {
      coverPhoto: user.coverPhoto,
    },
  });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/user/avatar
//  Remove avatar → reset to null
// ─────────────────────────────────────────────
export const removeAvatar = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId, "image").catch(() => {});
  }

  user.avatar = { url: null, publicId: null };
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Avatar removed.",
  });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/user/cover-photo
//  Remove cover photo → reset to null
// ─────────────────────────────────────────────
export const removeCoverPhoto = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  if (user.coverPhoto?.publicId) {
    await deleteFromCloudinary(user.coverPhoto.publicId, "image").catch(
      () => {}
    );
  }

  user.coverPhoto = { url: null, publicId: null };
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Cover photo removed.",
  });
});


export const updateProfile = asyncHandler(async (req, res, next) => {
  const { fullName, bio, designation, dateOfBirth, gender, website, businessCategory, location  } = req.body;

  const updateFields = {};
  if (fullName    !== undefined) updateFields.fullName    = fullName;
  if (bio         !== undefined) updateFields.bio         = bio;
  if (designation !== undefined) updateFields.designation = designation;
  if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth || null;
  if (gender      !== undefined) updateFields.gender      = gender || null;
  if (website     !== undefined) updateFields.website     = website || null;
  if (businessCategory !== undefined) updateFields.businessCategory = businessCategory || null;
  if (location         !== undefined) updateFields.location         = location || null;
  // location ke baad yeh add karo:
if (location?.city || location?.state) {
  try {
    const query = [location.city, location.state, location.country || "India"]
      .filter(Boolean).join(", ");
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
  } catch {
    // Geocoding fail — sirf city/state save karo, coordinates baad mein
  }
}

  // ✅ Pehle update karo, phir fresh fetch karo — toSafeObject() ke liye
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { runValidators: true }
  );

  const updatedUser = await User.findById(req.user._id);
  if (!updatedUser) return next(new AppError("User not found.", 404));

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: updatedUser.toSafeObject(),  // ✅ Ab proper Mongoose instance hai
  });
});



// ─────────────────────────────────────────────
//  GET /api/v2/users/map-sellers
//  Map pe real sellers dikhao
// ─────────────────────────────────────────────
export const getMapSellers = asyncHandler(async (req, res) => {
  const { q, category } = req.query;

const filter = {
  accountStatus: "active",
  $or: [
    { "location.coordinates.coordinates": { $exists: true, $size: 2 } },
    { "location.city": { $exists: true, $ne: null } },
  ],
};

  if (category && category !== "all") {
    filter.businessCategory = category;
  }

  if (q) {
    filter.$or = [
      { fullName:         { $regex: q, $options: "i" } },
      { designation:      { $regex: q, $options: "i" } },
      { "location.city":  { $regex: q, $options: "i" } },
      { businessCategory: { $regex: q, $options: "i" } },
    ];
  }

  const users = await User.find(filter)
    .select("fullName username avatar designation businessCategory location followersCount isVerifiedBadge isPrivate")
    .limit(200);

  return res.status(200).json({
    success: true,
    users,
  });
});