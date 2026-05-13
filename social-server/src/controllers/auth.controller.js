
import SocialUser from "../models/User.model.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/email.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
  );
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || "7d" }
  );
  return { accessToken, refreshToken };
};

const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const sanitizeUser = (user) => ({
  _id:             user._id,
  name:            user.name,
  username:        user.username,
  email:           user.email,
  avatar:          user.avatar,
  role:            user.role,
  isEmailVerified: user.isEmailVerified,
  designation:     user.designation,
  bio:             user.bio,
  businessCategory:user.businessCategory,
});

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────

export const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: "Saare fields bharo" });
    }

    // Duplicate check
    const existing = await SocialUser.findOne({
      $or: [
        { email:    email.toLowerCase().trim() },
        { username: username.toLowerCase().trim() },
      ],
    });

    if (existing) {
      const field = existing.email === email.toLowerCase() ? "Email" : "Username";
      return res.status(409).json({ message: `${field} pehle se registered hai` });
    }

    const user = await SocialUser.create({ name, username, email, password });

    // OTP bhejo
    const otp = await user.generateOtp("email_verify");
    await sendEmail({
      to:      user.email,
      subject: "Email verify karo",
      text:    `Tera OTP hai: ${otp}. 10 minute mein expire ho jayega.`,
    });

    return res.status(201).json({
      message: "Account ban gaya! Email pe OTP bheja hai.",
      userId:  user._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ message: `${field} pehle se liya hua hai` });
    }
    if (err.name === "ValidationError") {
      const msg = Object.values(err.errors)[0].message;
      return res.status(400).json({ message: msg });
    }
    console.error("register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Verify Email OTP
// ─────────────────────────────────────────────────────────────────────────────

export const verifyEmail = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) return res.status(400).json({ message: "userId aur OTP zaroori hai" });

    const user = await SocialUser.findById(userId).select("+otp");
    if (!user) return res.status(404).json({ message: "User nahi mila" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email pehle se verified hai" });

    const result = await user.verifyOtp(otp, "email_verify");
    if (!result.ok) return res.status(400).json({ message: result.reason });

    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);

    return res.json({
      message:     "Email verified!",
      accessToken,
      user:        sanitizeUser(user),
    });
  } catch (err) {
    console.error("verifyEmail error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email aur password do" });

    const user = await SocialUser.findByEmailWithPassword(email);
    if (!user) return res.status(401).json({ message: "Email ya password galat hai" });

    // Suspension check
    if (user.isSuspended && user.isSuspensionActive) {
      const until = user.suspendUntil
        ? `${user.suspendUntil.toLocaleDateString()} tak`
        : "permanently";
      return res.status(403).json({
        message: `Account suspend hai (${until}). Reason: ${user.suspendReason}`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Email ya password galat hai" });

    if (!user.isEmailVerified) {
      const otp = await user.generateOtp("email_verify");
      await sendEmail({
        to:      user.email,
        subject: "Email verify karo",
        text:    `Tera OTP: ${otp}`,
      });
      return res.status(403).json({
        message: "Email verify nahi hua. Naya OTP bheja gaya.",
        userId:  user._id,
        requiresVerification: true,
      });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    user.lastSeen     = new Date();
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);

    return res.json({
      message:     "Login successful",
      accessToken,
      user:        sanitizeUser(user),
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth
// ─────────────────────────────────────────────────────────────────────────────

export const googleAuth = async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body;
    if (!googleId || !email) return res.status(400).json({ message: "Google data incomplete hai" });

    const user = await SocialUser.findOrCreateGoogleUser({ googleId, email, name, avatar });

    if (user.isSuspended && user.isSuspensionActive) {
      return res.status(403).json({ message: "Account suspend hai" });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    user.lastSeen     = new Date();
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);

    return res.json({
      message:     "Google login successful",
      accessToken,
      user:        sanitizeUser(user),
    });
  } catch (err) {
    console.error("googleAuth error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Token
// ─────────────────────────────────────────────────────────────────────────────

export const refreshAccessToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "Refresh token nahi mila" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "Refresh token invalid ya expire ho gaya" });
    }

    const user = await SocialUser.findById(decoded.id).select("+refreshToken");
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ message: "Token mismatch — dobara login karo" });
    }

    const { accessToken, refreshToken: newRefresh } = generateTokens(user._id);
    user.refreshToken = newRefresh;
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, newRefresh);

    return res.json({ accessToken });
  } catch (err) {
    console.error("refreshAccessToken error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      // DB se refresh token hata do
      await SocialUser.findOneAndUpdate(
        { refreshToken: token },
        { $unset: { refreshToken: 1 } }
      );
    }

    res.clearCookie("refreshToken");
    return res.json({ message: "Logout successful" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Forgot Password
// ─────────────────────────────────────────────────────────────────────────────

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email do" });

    // Always same response — enumeration prevent karo
    const user = await SocialUser.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (user) {
      const otp = await user.generateOtp("password_reset");
      await sendEmail({
        to:      user.email,
        subject: "Password reset OTP",
        text:    `Password reset karne ka OTP: ${otp}. 10 minute mein expire hoga.`,
      });
    }

    return res.json({ message: "Agar email registered hai toh OTP bheja gaya hai" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────────────────────────────────────

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP aur naya password zaroori hai" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password kam se kam 8 characters ka hona chahiye" });
    }

    const user = await SocialUser.findByEmailWithPassword(email);
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    const result = await user.verifyOtp(otp, "password_reset");
    if (!result.ok) return res.status(400).json({ message: result.reason });

    user.password = newPassword;
    await user.save();

    // Sab jagah se logout karo
    user.refreshToken = undefined;
    await user.save({ validateBeforeSave: false });
    res.clearCookie("refreshToken");

    return res.json({ message: "Password reset ho gaya! Dobara login karo." });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Resend OTP
// ─────────────────────────────────────────────────────────────────────────────

export const resendOtp = async (req, res) => {
  try {
    const { userId, purpose } = req.body;
    if (!userId || !purpose) return res.status(400).json({ message: "userId aur purpose do" });

    const validPurposes = ["email_verify", "password_reset", "login"];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json({ message: "Invalid purpose" });
    }

    const user = await SocialUser.findById(userId).select("+otp");
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    const otp = await user.generateOtp(purpose);
    await sendEmail({
      to:      user.email,
      subject: "Naya OTP",
      text:    `Tera naya OTP: ${otp}`,
    });

    return res.json({ message: "Naya OTP bheja gaya" });
  } catch (err) {
    console.error("resendOtp error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Current User (me)
// ─────────────────────────────────────────────────────────────────────────────

export const getMe = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User nahi mila" });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Search Users
// ─────────────────────────────────────────────────────────────────────────────

export const searchUsers = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q || q.trim().length < 1) {
      return res.status(400).json({ message: "Search query do" });
    }

    const regex = new RegExp(q.trim(), "i");
    const skip  = (parseInt(page) - 1) * parseInt(limit);

    const users = await SocialUser.find({
      isDeleted:   false,
      isSuspended: false,
      $or: [{ name: regex }, { username: regex }],
    })
      .select("name username avatar designation businessCategory followersCount")
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return res.json({ users, page: parseInt(page) });
  } catch (err) {
    console.error("searchUsers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Suspend / Unsuspend / Warn
// ─────────────────────────────────────────────────────────────────────────────

export const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, days } = req.body;

    if (!reason) return res.status(400).json({ message: "Reason do" });

    const user = await SocialUser.findById(userId);
    if (!user) return res.status(404).json({ message: "User nahi mila" });
    if (user.role === "super_admin") {
      return res.status(403).json({ message: "Super admin ko suspend nahi kar sakte" });
    }

    await user.suspend({ reason, by: req.user._id, days: days || null });

    return res.json({ message: `User suspend ho gaya${days ? ` (${days} din ke liye)` : " (permanent)"}` });
  } catch (err) {
    console.error("suspendUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const unsuspendUser = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    await user.unsuspend(req.user._id);
    return res.json({ message: "User unsuspend ho gaya" });
  } catch (err) {
    console.error("unsuspendUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const warnUser = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "Warning reason do" });

    const user = await SocialUser.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    await user.addWarning(reason, req.user._id);

    const msg = user.warningCount >= 3
      ? "3 warnings ho gayi — user auto-suspend ho gaya"
      : `Warning di gayi (${user.warningCount}/3)`;

    return res.json({ message: msg, warningCount: user.warningCount });
  } catch (err) {
    console.error("warnUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};