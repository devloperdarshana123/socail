import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
import redis from "../../config/redis.js"
// ─────────────────────────────────────────────
//  GET /api/v2/settings/me
//  Logged-in user ka profile fetch karo
// ─────────────────────────────────────────────
export const getMyProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("-password -__v -refreshTokens");
  if (!user) return next(new AppError("User not found.", 404));

  res.status(200).json({
    success: true,
    message: "Profile fetched successfully.",
    data: { user },
  });
});

// ─────────────────────────────────────────────
//  PATCH /api/v2/settings/profile
//  fullName, bio, designation update karo
// ─────────────────────────────────────────────
export const updateProfile = asyncHandler(async (req, res, next) => {
  const { 
    fullName, bio, designation, dateOfBirth, 
    gender, website, businessCategory, location 
  } = req.body;

  const updateFields = {};
if (fullName !== undefined) {
  if (fullName.trim().length < 2 || fullName.trim().length > 50) {
    return next(new AppError("Full name must be between 2 and 50 characters.", 400));
  }
  updateFields.fullName = fullName.trim();
}

if (bio !== undefined) {
  if (bio.length > 300) {
    return next(new AppError("Bio cannot exceed 300 characters.", 400));
  }
  updateFields.bio = bio;
}
  if (designation       !== undefined) updateFields.designation       = designation;
  if (dateOfBirth       !== undefined) updateFields.dateOfBirth       = dateOfBirth || null;
  if (gender            !== undefined) updateFields.gender            = gender || null;
  if (website           !== undefined) updateFields.website           = website || null;
  if (businessCategory  !== undefined) updateFields.businessCategory  = businessCategory || null;

  // Location + Nominatim geocoding
  if (location !== undefined) {
    if (!location) {
      updateFields.location = null;
    } else {
      updateFields.location = location;

      // Nominatim se lat/lng fetch karo
      if (location.city || location.state || location.country) {
        try {
          const query = [location.city, location.state, location.country]
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
                coordinates: [
                  parseFloat(geoData[0].lon),
                  parseFloat(geoData[0].lat),
                ],
              },
            };
          }
        } catch {
          // Geocoding fail — sirf city/state/country save karo
        }
      }
    }
  }

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
//     data: updatedUser.toSafeObject(),  // ← { user: ... } hata do, directly data
//   });
// });
await User.findByIdAndUpdate(
  req.user._id,
  { $set: updateFields },
  { runValidators: true }
);

const updatedUser = await User.findById(req.user._id);
if (!updatedUser) return next(new AppError("User not found.", 404));

// Redis cache clear karo — refresh pe stale data na aaye
await redis.del(`user:auth:${req.user._id}`).catch(() => {});

res.status(200).json({
  success: true,
  message: "Profile updated successfully.",
  data: updatedUser.toSafeObject(),
});
});
// ─────────────────────────────────────────────
//  PATCH /api/v2/settings/password
//  Old password verify → naya hash karke save
// ─────────────────────────────────────────────
export const updatePassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  if (!newPassword) {
    return next(new AppError("New password is required.", 400));
  }
  if (newPassword.length < 8) {
    return next(new AppError("New password must be at least 8 characters long.", 400));
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user) return next(new AppError("User not found.", 404));

  const isGoogleUser = user.authProvider === "google" && !user.password;

  if (isGoogleUser) {
    // Google user — no old password needed, sirf naya set karo
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    // authProvider update karo — ab email se bhi login kar sakta hai
    await User.findByIdAndUpdate(user._id, {
      $set: { authProvider: "google" }, // google raho — email bhi kaam karega
    });

    return res.status(200).json({
      success: true,
      message: "Password created successfully. You can now login with email too.",
      data: {},
    });
  }

  // Normal user — old password required
  if (!oldPassword) {
    return next(new AppError("Current password is required.", 400));
  }
  if (oldPassword === newPassword) {
    return next(new AppError("New password must be different from old password.", 400));
  }

  const isMatch = await user.isPasswordCorrect(oldPassword);
  if (!isMatch) return next(new AppError("The current password is incorrect.", 401));

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    success: true,
    message: "Password updated successfully.",
    data: {},
  });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/settings/deactivate
//  Account permanently delete karo
// ─────────────────────────────────────────────
export const deactivateAccount = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found.", 404));

  // Soft delete — anonymize karo
  user.accountStatus = "deactivated";
  user.fullName      = "Deleted User";
  user.username      = `deleted_${user._id}`;
  user.email         = `deleted_${user._id}@removed.com`;
  user.bio           = "";
  user.designation   = "";
  user.avatar        = null;

  await user.save({ validateBeforeSave: false });

 res.clearCookie("refreshtoken", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
});

  res.status(200).json({
    success: true,
    message: "Account deactivated successfully.",
    data: {},
  });
});