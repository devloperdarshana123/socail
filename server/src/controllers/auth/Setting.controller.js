import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
// ─────────────────────────────────────────────
//  GET /api/v2/settings/me
//  Logged-in user ka profile fetch karo
// ─────────────────────────────────────────────
export const getMyProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("-password -__v");
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
  if (fullName          !== undefined) updateFields.fullName          = fullName;
  if (bio               !== undefined) updateFields.bio               = bio;
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
    data: updatedUser.toSafeObject(),  // ← { user: ... } hata do, directly data
  });
});

// ─────────────────────────────────────────────
//  PATCH /api/v2/settings/password
//  Old password verify → naya hash karke save
// ─────────────────────────────────────────────
export const updatePassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return next(new AppError("Old and new password are required.", 400));
  }

  if (newPassword.length < 8) {
    return next(
      new AppError("New password must be at least 8 characters long.", 400)
    );
  }

  if (oldPassword === newPassword) {
    return next(
      new AppError("The new password must be different from the old password.", 400)
    );
  }

  // +password explicitly select karo (model mein select:false hoga)
  const user = await User.findById(req.user._id).select("+password");
  if (!user) return next(new AppError("User not found.", 404));

  // Model ka isPasswordCorrect method use karo (bcrypt.compare internally)
  const isMatch = await user.isPasswordCorrect(oldPassword);
  if (!isMatch) return next(new AppError("The old password is incorrect.", 401));

  // Directly assign karo — pre-save hook khud bcrypt.genSalt(12) se hash karega
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
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

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({
    success: true,
    message: "Account deactivated successfully.",
    data: {},
  });
});