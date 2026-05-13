
import SocialUser from "../models/User.model.js";
import Post from "../models/Post.model.js";
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

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete:", err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Profile (public)
// ─────────────────────────────────────────────────────────────────────────────

export const getProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await SocialUser.findByUsername(username);
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    // Block check
    if (user.blockedUsers?.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Profile accessible nahi hai" });
    }

    const currentUser  = await SocialUser.findById(req.user._id).select("following blockedUsers");
    const isFollowing  = currentUser.following.some((id) => id.toString() === user._id.toString());
    const isBlocked    = currentUser.blockedUsers.some((id) => id.toString() === user._id.toString());
    const isSelf       = req.user._id.toString() === user._id.toString();

    return res.json({
      user: {
        ...user.toObject(),
        isFollowing,
        isBlocked,
        isSelf,
      },
    });
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Update Profile
// ─────────────────────────────────────────────────────────────────────────────

export const updateProfile = async (req, res) => {
  try {
    const allowed = ["name", "username", "bio", "designation", "website", "interests", "businessCategory"];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Username uniqueness check
    if (updates.username) {
      const taken = await SocialUser.findOne({
        username: updates.username.toLowerCase(),
        _id:      { $ne: req.user._id },
      });
      if (taken) return res.status(409).json({ message: "Username pehle se liya hua hai" });
      updates.username = updates.username.toLowerCase().trim();
    }

    // Interests array ho
    if (updates.interests && !Array.isArray(updates.interests)) {
      updates.interests = String(updates.interests).split(",").map((i) => i.trim());
    }

    const user = await SocialUser.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.json({ message: "Profile update ho gaya", user });
  } catch (err) {
    if (err.name === "ValidationError") {
      const msg = Object.values(err.errors)[0].message;
      return res.status(400).json({ message: msg });
    }
    console.error("updateProfile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Upload Avatar
// ─────────────────────────────────────────────────────────────────────────────

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image file do" });

    const user = await SocialUser.findById(req.user._id).select("avatar");

    // Purani image delete karo
    if (user.avatar?.publicId) {
      await deleteFromCloudinary(user.avatar.publicId);
    }

    const result = await uploadBuffer(req.file.buffer, {
      folder:       "social/avatars",
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    user.avatar = { url: result.secure_url, publicId: result.public_id };
    await user.save({ validateBeforeSave: false });

    return res.json({ message: "Avatar updated",user: { avatar: user.avatar.url } });
  } catch (err) {
    console.error("uploadAvatar error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Upload Cover Photo
// ─────────────────────────────────────────────────────────────────────────────

export const uploadCoverPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image file do" });

    const user = await SocialUser.findById(req.user._id).select("coverPhoto");

    if (user.coverPhoto?.publicId) {
      await deleteFromCloudinary(user.coverPhoto.publicId);
    }

    const result = await uploadBuffer(req.file.buffer, {
      folder:       "social/covers",
      transformation: [
        { width: 1200, height: 400, crop: "fill" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    user.coverPhoto = { url: result.secure_url, publicId: result.public_id };
    await user.save({ validateBeforeSave: false });

    return res.json({ message: "Cover photo update ho gaya", coverPhoto: user.coverPhoto });
  } catch (err) {
    console.error("uploadCoverPhoto error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────────────────────────────────────

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current aur naya password do" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Naya password kam se kam 8 characters ka hona chahiye" });
    }

    const user = await SocialUser.findByEmailWithPassword(req.user.email);
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    // Google-only users ke liye password nahi hoga
    if (!user.password) {
      return res.status(400).json({ message: "Google account pe password change nahi hota" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: "Current password galat hai" });

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "Naya password purane se alag hona chahiye" });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ message: "Password change ho gaya" });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Update Location
// ─────────────────────────────────────────────────────────────────────────────

export const updateLocation = async (req, res) => {
  try {
    const { lat, lng, city, state, country, businessCategory } = req.body;
    const updateData = {};

    if (lat !== undefined && lng !== undefined) {
      const latitude  = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ message: "Valid lat/lng do" });
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ message: "Coordinates range se bahar hain" });
      }

      updateData["location.type"]        = "Point";
      updateData["location.coordinates"] = [longitude, latitude];
    }

    if (city     !== undefined) updateData["location.city"]    = city;
    if (state    !== undefined) updateData["location.state"]   = state;
    if (country  !== undefined) updateData["location.country"] = country;
    if (businessCategory)       updateData["businessCategory"] = businessCategory;

    await SocialUser.findByIdAndUpdate(req.user._id, { $set: updateData });

    return res.json({ message: "Location update ho gayi" });
  } catch (err) {
    console.error("updateLocation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Nearby Sellers
// ─────────────────────────────────────────────────────────────────────────────

export const getNearbySellers = async (req, res) => {
  try {
    const { lng, lat, maxDistance = 500000, category, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const currentUser = await SocialUser.findById(req.user._id).select("following blockedUsers");
    const blockedUsers = currentUser ? (currentUser.blockedUsers || []) : [];

    const query = {
      _id:         { $nin: [req.user._id, ...blockedUsers] },
      isDeleted:   false,
      isSuspended: false,
    };

    if (category && category !== "all") query.businessCategory = category;

    if (lat && lng) {
      query["location"] = {
        $near: {
          $geometry: {
            type:        "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      };
    } else {
      // Coordinates 0,0 wale exclude karo (default value)
      query["location.coordinates"] = { $ne: [0, 0] };
    }

    const countQuery = { ...query };
    if (lat && lng) {
      countQuery["location"] = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            parseInt(maxDistance) / 6378100, // convert meters to radians
          ],
        },
      };
    }

    const [sellers, total] = await Promise.all([
      SocialUser.find(query)
        .select("_id name username avatar designation businessCategory location followers")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      SocialUser.countDocuments(countQuery),
    ]);

    const followingSet = new Set(currentUser ? (currentUser.following || []).map(String) : []);

    const result = sellers.map((u) => ({
      _id:             u._id,
      name:            u.name,
      username:        u.username,
      avatar:          u.avatar,
      designation:     u.designation,
      businessCategory:u.businessCategory,
      city:            u.location?.city || "",
      country:         u.location?.country || "",
      coordinates:     u.location?.coordinates || [0, 0],
      followersCount:  u.followers?.length || 0,
      isFollowing:     followingSet.has(u._id.toString()),
    }));

    return res.json({ sellers: result, total, page: parseInt(page) });
  } catch (err) {
    console.error("getNearbySellers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Deactivate Account (soft delete)
// ─────────────────────────────────────────────────────────────────────────────


export const getMyProfile = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};
export const deactivateAccount = async (req, res) => {
  try {
    const { password } = req.body;

    const user = await SocialUser.findByEmailWithPassword(req.user.email);
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    // Google-only users ke liye password check nahi
    if (user.password) {
      if (!password) return res.status(400).json({ message: "Password confirm karo" });
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ message: "Password galat hai" });
    }

    await user.softDelete();

    // Logout bhi karo
    user.refreshToken = undefined;
    await user.save({ validateBeforeSave: false });
    res.clearCookie("refreshToken");

    return res.json({ message: "Account deactivate ho gaya" });
  } catch (err) {
    console.error("deactivateAccount error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const removeAvatar = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.user._id).select("avatar");
    if (user.avatar?.publicId) {
      await deleteFromCloudinary(user.avatar.publicId);
    }
    user.avatar = { url: "", publicId: "" };
    await user.save({ validateBeforeSave: false });
    return res.json({ message: "Avatar remove ho gaya" });
  } catch (err) {
    console.error("removeAvatar error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};