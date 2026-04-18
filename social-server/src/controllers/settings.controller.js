// import SocialUser from "../models/User.model.js";
// import Post from "../models/Post.model.js";
// import cloudinary from "../config/cloudinary.js";

// // ── Update Profile ────────────────────────────────────────────────────────────
// export const updateProfile = async (req, res) => {
//   try {
//     const { name, email, designation, bio, country, state, businessCategory,  interests  } = req.body;

//     if (!name?.trim() || !email?.trim()) {
//       return res.status(400).json({ message: "Name and email are mandatory!" });
//     }

//     const existing = await SocialUser.findOne({ email, _id: { $ne: req.user._id } });
//     if (existing) {
//       return res.status(400).json({ message: "Email already in use!" });
//     }

//     const user = await SocialUser.findByIdAndUpdate(
//       req.user._id,
//       { 
//   name, email, 
//   designation: designation?.trim() ?? "", 
//   bio: bio?.trim() ?? "",
//      "location.city": city ?? "",       
//   "location.country": country ?? "",
//   "location.state": state ?? "",
//   businessCategory: businessCategory ?? "other",
//   interests: interests ?? [],          // ← add
// },
//       { new: true, runValidators: true }
//     ).select("-password");

//     res.json({ message: "Profile updated!", user });
//   } catch (err) {
//     res.status(500).json({ message: "Server error!", error: err.message });
//   }
// };

// // ── Change Password ───────────────────────────────────────────────────────────
// export const changePassword = async (req, res) => {
//   try {
//     const { oldPassword, newPassword } = req.body;

//     if (!oldPassword || !newPassword) {
//       return res.status(400).json({ message: "Both fields are mandatory!" });
//     }
//     if (newPassword.length < 6) {
//       return res.status(400).json({ message: "Min 6 characters!" });
//     }

//     const user = await SocialUser.findById(req.user._id);
//     const isMatch = await user.comparePassword(oldPassword);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Wrong current password!" });
//     }

//     user.password = newPassword;
//     await user.save();

//     res.json({ message: "Password changed!" });
//   } catch (err) {
//     res.status(500).json({ message: "Server error!", error: err.message });
//   }
// };

// // ── Deactivate Account ────────────────────────────────────────────────────────
// export const deactivateAccount = async (req, res) => {
//   try {
//    await Post.deleteMany({ author: req.user._id });
// await SocialUser.updateMany(
//   { $or: [{ followers: req.user._id }, { following: req.user._id }] },
//   { $pull: { followers: req.user._id, following: req.user._id } }
// );
// await SocialUser.findByIdAndDelete(req.user._id);

//     res.json({ message: "Account deactivated!" });
//   } catch (err) {
//     res.status(500).json({ message: "Server error!", error: err.message });
//   }
// };

// // ── Upload Avatar ─────────────────────────────────────────────────────────────
// export const uploadAvatar = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "Image required!" });
//     }

//     const user = await SocialUser.findById(req.user._id);
//     if (user.avatar) {
//       const publicId = user.avatar.split("/").pop().split(".")[0];
//       await cloudinary.uploader.destroy(`erosocial/avatars/${publicId}`);
//     }

//     const result = await cloudinary.uploader.upload(req.file.path, {
//       folder: "erosocial/avatars",
//     });

//     const updatedUser = await SocialUser.findByIdAndUpdate(  // ← updatedUser
//       req.user._id,
//       { avatar: result.secure_url },
//       { new: true }
//     ).select("-password");

//     res.json({ message: "Avatar updated!", user: updatedUser });  // ← updatedUser
//   } catch (err) {
//     res.status(500).json({ message: "Server error!", error: err.message });
//   }
// };

// // ── Remove Avatar ─────────────────────────────────────────────────────────────
// export const removeAvatar = async (req, res) => {
//   try {
//     const user = await SocialUser.findByIdAndUpdate(
//       req.user._id,
//       { avatar: "" },
//       { new: true }
//     ).select("-password");

//     res.json({ message: "Avatar removed!", user });
//   } catch (err) {
//     res.status(500).json({ message: "Server error!", error: err.message });
//   }
// };


// // settings.controller.js ke end mein add karo
// export const uploadCoverPhoto = async (req, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ message: "Image required!" });

//     const user = await SocialUser.findById(req.user._id);
//     if (user.coverPhoto) {
//       const publicId = user.coverPhoto.split("/").pop().split(".")[0];
//       await cloudinary.uploader.destroy(`erosocial/covers/${publicId}`);
//     }

//     const result = await cloudinary.uploader.upload(req.file.path, {
//       folder: "erosocial/covers",
//     });

//     const updatedUser = await SocialUser.findByIdAndUpdate(
//       req.user._id,
//       { coverPhoto: result.secure_url },
//       { new: true }
//     ).select("-password");

//     res.json({ message: "Cover photo updated!", user: updatedUser });
//   } catch (err) {
//     res.status(500).json({ message: "Server error!", error: err.message });
//   }
// };


import SocialUser from "../models/User.model.js";
import Post from "../models/Post.model.js";
import cloudinary from "../config/cloudinary.js";

// ── Update Profile ────────────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    // ✅ city add kiya — pehle missing tha (ReferenceError deta tha)
    const { name, email, designation, bio, city, country, state, businessCategory, interests } = req.body;

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: "Name and email are mandatory!" });
    }

    const existing = await SocialUser.findOne({ email, _id: { $ne: req.user._id } });
    if (existing) {
      return res.status(400).json({ message: "Email already in use!" });
    }

    const user = await SocialUser.findByIdAndUpdate(
      req.user._id,
      {
        name, email,
        designation: designation?.trim() ?? "",
        bio: bio?.trim() ?? "",
        "location.city":    city    ?? "",
        "location.country": country ?? "",
        "location.state":   state   ?? "",
        businessCategory: businessCategory ?? "other",
        interests: interests ?? [],
      },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({ message: "Profile updated!", user });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Change Password ───────────────────────────────────────────────────────────
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both fields are mandatory!" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Min 6 characters!" });
    }

    const user = await SocialUser.findById(req.user._id);
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Wrong current password!" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed!" });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Deactivate Account ────────────────────────────────────────────────────────
export const deactivateAccount = async (req, res) => {
  try {
    await Post.deleteMany({ author: req.user._id });
    await SocialUser.updateMany(
      { $or: [{ followers: req.user._id }, { following: req.user._id }] },
      { $pull: { followers: req.user._id, following: req.user._id } }
    );
    await SocialUser.findByIdAndDelete(req.user._id);

    res.json({ message: "Account deactivated!" });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Upload Avatar ─────────────────────────────────────────────────────────────
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image required!" });
    }

    const user = await SocialUser.findById(req.user._id);
    if (user.avatar) {
      const publicId = user.avatar.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`erosocial/avatars/${publicId}`);
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "erosocial/avatars",
    });

    const updatedUser = await SocialUser.findByIdAndUpdate(
      req.user._id,
      { avatar: result.secure_url },
      { new: true }
    ).select("-password");

    res.json({ message: "Avatar updated!", user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Remove Avatar ─────────────────────────────────────────────────────────────
export const removeAvatar = async (req, res) => {
  try {
    const user = await SocialUser.findByIdAndUpdate(
      req.user._id,
      { avatar: "" },
      { new: true }
    ).select("-password");

    res.json({ message: "Avatar removed!", user });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Upload Cover Photo ────────────────────────────────────────────────────────
export const uploadCoverPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image required!" });

    const user = await SocialUser.findById(req.user._id);
    if (user.coverPhoto) {
      const publicId = user.coverPhoto.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`erosocial/covers/${publicId}`);
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "erosocial/covers",
    });

    const updatedUser = await SocialUser.findByIdAndUpdate(
      req.user._id,
      { coverPhoto: result.secure_url },
      { new: true }
    ).select("-password");

    res.json({ message: "Cover photo updated!", user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};