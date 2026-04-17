import jwt from "jsonwebtoken";
import SocialUser from "../models/User.model.js";

// ── Protect — login check ─────────────────────────────────────────────────────
export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Login karo pehle!" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await SocialUser.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User nahi mila!" });
    }

    // ✅ Suspended user ka token bhi reject karo
    if (user.isSuspended) {
      return res.status(403).json({
        message: "Aapka account suspend hai. Admin se contact karo.",
      });
    }

    req.user = user;
    next();
 } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expire ho gaya, dobara login karo!" });
    }
    res.status(401).json({ message: "Invalid token!" });
  }
};

// ── Super Admin Only ──────────────────────────────────────────────────────────
export const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "super_admin") {
    return res.status(403).json({ message: "Sirf Super Admin yeh kar sakta hai!" });
  }
  next();
};