


import jwt from "jsonwebtoken";
import SocialUser from "../models/User.model.js";
import Post from "../models/Post.model.js";
import { verifyGoogleToken } from "../config/firebase.js"

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// ── ✅ Helper — har jagah ek jaisa user object return hoga ────────────────────
const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  coverPhoto: user.coverPhoto,
  bio: user.bio,
  designation: user.designation,
  location: user.location,          // { city, state, country, coordinates }
  interests: user.interests,
  businessCategory: user.businessCategory,
  isSuspended: user.isSuspended,
});

// ── Register ─────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    const existingUser = await SocialUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "This email is already registered!" });
    }

    const user = await SocialUser.create({
      name,
      email,
      password,
      role: "user",
    });

    const token = generateToken(user._id);

    res.status(201).json({ token, user: formatUser(user) }); // ✅
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await SocialUser.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password!" });
    }

    if (!user.password && user.googleId) {
      return res.status(401).json({
        message: "This account uses Google login. Please sign in with Google.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password!" });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        message: "Your account has been suspended. Please contact the admin.",
      });
    }

    const token = generateToken(user._id);

    res.json({ token, user: formatUser(user) }); // ✅
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Google Auth ───────────────────────────────────────────────────────────────
export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    let googleUser;
    try {
      googleUser = await verifyGoogleToken(idToken);
    } catch (firebaseError) {
      return res.status(401).json({ message: firebaseError.message });
    }

    const { googleId, email, name, picture } = googleUser;

    if (!email) {
      return res.status(400).json({ message: "Google account mein email nahi mili" });
    }

    let user = await SocialUser.findOne({ email });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.avatar && picture) user.avatar = picture;
        await user.save();
      }

      if (user.isSuspended) {
        return res.status(403).json({
          message: "Your account has been suspended. Please contact the admin.",
        });
      }
    } else {
      user = await SocialUser.create({
        name: name || email.split("@")[0],
        email,
        googleId,
        avatar: picture || "",
        role: "user",
      });
    }

    const token = generateToken(user._id);

    res.json({ token, user: formatUser(user) }); // ✅
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get Me ───────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.user._id).select("-password");
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get User Stats ────────────────────────────────────────────────────────────
export const getUserStats = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.user._id).select("-password");
    const postCount = await Post.countDocuments({ author: req.user._id });

    res.json({
      posts: postCount,
      followers: user.followers?.length || 0,
      following: user.following?.length || 0,
      followRequests: user.followRequests?.length || 0,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get Suggested Users ───────────────────────────────────────────────────────
export const getSuggestions = async (req, res) => {
  try {
    const currentUser = await SocialUser.findById(req.user._id).select("following");

    const excludeIds = [
      req.user._id,
      ...(currentUser.following || []),
    ];

    const users = await SocialUser.find({
      _id: { $nin: excludeIds },
      isSuspended: false,
    })
      .select("name role avatar followers following designation")
      .limit(20);

    const shuffled = users.sort(() => Math.random() - 0.5).slice(0, 8);
    res.json({ success: true, users: shuffled });

  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Search Users ──────────────────────────────────────────────────────────────
export const searchUsers = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) {
      return res.status(400).json({ message: "Search query is required!" });
    }

    const users = await SocialUser.find({
      name: { $regex: q, $options: "i" },
      isSuspended: false,
      _id: { $ne: req.user._id },
    })
      .select("name role avatar followers following designation")
      .limit(10);

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── [SUPER ADMIN] Get All Users ───────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const users = await SocialUser.find({ role: { $ne: "super_admin" } })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── [SUPER ADMIN] Suspend User ────────────────────────────────────────────────
export const suspendUser = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found!" });
    if (user.role === "super_admin") {
      return res.status(403).json({ message: "You are not allowed to suspend a super admin!" });
    }

    user.isSuspended = !user.isSuspended;
    await user.save();

    res.json({
      message: user.isSuspended ? "User has been suspended!" : "User has been unsuspended!",
      user,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── [SUPER ADMIN] Delete User ─────────────────────────────────────────────────
export const deleteUser = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found!" });
    if (user.role === "super_admin") {
      return res.status(403).json({ message: "Super admin cannot be deleted!" });
    }

    await Post.deleteMany({ author: req.params.id });
    await SocialUser.updateMany(
      { $or: [{ followers: req.params.id }, { following: req.params.id }] },
      { $pull: { followers: req.params.id, following: req.params.id } }
    );

    await SocialUser.findByIdAndDelete(req.params.id);

    res.json({ message: "User and all associated data has been deleted!" });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
  try {
    res.json({ message: "Logged out successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};


// ── Get Public User Profile ───────────────────────────────────────────────────
export const getUserProfile = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.params.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found!" });

    const postCount = await Post.countDocuments({ author: req.params.userId });

    res.json({
      success: true,
      user,
      stats: {
        posts: postCount,
        followers: user.followers?.length || 0,
        following: user.following?.length || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};