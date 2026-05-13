// // import jwt from "jsonwebtoken";
// // import SocialUser from "../models/User.model.js";

// // // ── Protect — login check ─────────────────────────────────────────────────────
// // export const protect = async (req, res, next) => {
// //   try {
// //     const token = req.headers.authorization?.split(" ")[1];
// //     if (!token) {
// //       return res.status(401).json({ message: "Login karo pehle!" });
// //     }

// //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
// //     const user = await SocialUser.findById(decoded.id).select("-password");

// //     if (!user) {
// //       return res.status(401).json({ message: "User nahi mila!" });
// //     }

// //     // ✅ Suspended user ka token bhi reject karo
// //     if (user.isSuspended) {
// //       return res.status(403).json({
// //         message: "Aapka account suspend hai. Admin se contact karo.",
// //       });
// //     }

// //     req.user = user;
// //     next();
// //  } catch (err) {
// //     if (err.name === "TokenExpiredError") {
// //       return res.status(401).json({ message: "Session expire ho gaya, dobara login karo!" });
// //     }
// //     res.status(401).json({ message: "Invalid token!" });
// //   }
// // };

// // // ── Super Admin Only ──────────────────────────────────────────────────────────
// // export const superAdminOnly = (req, res, next) => {
// //   if (!req.user || req.user.role !== "super_admin") {
// //     return res.status(403).json({ message: "Sirf Super Admin yeh kar sakta hai!" });
// //   }
// //   next();
// // };



// import SocialUser from "../models/User.model.js";
// import { verifyAccessToken } from "../utils/token.utils.js";

// // ─────────────────────────────────────────────────────────────────────────────
// // protect — every protected route pe lagao
// // ─────────────────────────────────────────────────────────────────────────────
// export const protect = async (req, res, next) => {
//   try {
//     // 1. Token extract karo — "Bearer <token>" format
//     const authHeader = req.headers.authorization;
//     if (!authHeader?.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         code:    "NO_TOKEN",
//         message: "Authentication required",
//       });
//     }

//     const token = authHeader.split(" ")[1];

//     // 2. Verify karo — expired/invalid dono handle hoga
//     const payload = verifyAccessToken(token);
//     if (!payload) {
//       return res.status(401).json({
//         success: false,
//         code:    "TOKEN_INVALID",
//         message: "Session expired. Please refresh your token.",
//       });
//     }

//     // 3. DB se user fetch karo
//     const user = await SocialUser.findById(payload.id).select(
//       "-password -emailVerificationOtp -passwordResetOtp -suspendHistory"
//     );

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         code:    "USER_NOT_FOUND",
//         message: "User no longer exists",
//       });
//     }

//     // 4. Soft deleted account check
//     if (user.isDeleted) {
//       return res.status(401).json({
//         success: false,
//         code:    "ACCOUNT_DELETED",
//         message: "This account has been deactivated",
//       });
//     }

//     // 5. Suspended account check
//     if (user.isSuspended) {
//       return res.status(403).json({
//         success: false,
//         code:    "ACCOUNT_SUSPENDED",
//         message: user.suspendedUntil
//           ? `Account suspended until ${user.suspendedUntil.toISOString()}`
//           : "Your account is suspended. Contact admin.",
//       });
//     }

//     // 6. Password change ke baad purana token reject karo
//     if (user.isPasswordChangedAfter(payload.iat)) {
//       return res.status(401).json({
//         success: false,
//         code:    "PASSWORD_CHANGED",
//         message: "Password recently changed. Please login again.",
//       });
//     }

//     req.user = user;
//     next();
//   } catch (err) {
//     next(err);
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // Role-based guards
// // ─────────────────────────────────────────────────────────────────────────────

// /** Sirf super_admin */
// export const superAdminOnly = (req, res, next) => {
//   if (req.user?.role !== "super_admin") {
//     return res.status(403).json({
//       success: false,
//       code:    "FORBIDDEN",
//       message: "Super admin access required",
//     });
//   }
//   next();
// };

// /** super_admin ya admin dono */
// export const adminOnly = (req, res, next) => {
//   if (!["super_admin", "admin"].includes(req.user?.role)) {
//     return res.status(403).json({
//       success: false,
//       code:    "FORBIDDEN",
//       message: "Admin access required",
//     });
//   }
//   next();
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // optionalProtect — public routes jahan login optional ho
// // (jaise public profile — logged in ho to extra data do)
// // ─────────────────────────────────────────────────────────────────────────────
// export const optionalProtect = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader?.startsWith("Bearer ")) return next(); // no token = guest

//     const token   = authHeader.split(" ")[1];
//     const payload = verifyAccessToken(token);
//     if (!payload) return next(); // invalid token = guest

//     const user = await SocialUser.findById(payload.id).select(
//       "-password -emailVerificationOtp -passwordResetOtp"
//     );

//     if (user && !user.isDeleted && !user.isSuspended) {
//       req.user = user;
//     }

//     next();
//   } catch {
//     next(); // error hone pe bhi guest treat karo
//   }
// };



import jwt from "jsonwebtoken";
import SocialUser from "../models/User.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — token verify karo
// ─────────────────────────────────────────────────────────────────────────────

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// protect — har protected route pe lagao
// ─────────────────────────────────────────────────────────────────────────────

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        code:    "NO_TOKEN",
        message: "Authentication required",
      });
    }

    const token   = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({
        success: false,
        code:    "TOKEN_INVALID",
        message: "Session expired. Please refresh your token.",
      });
    }

    // DB se user — password, otp, suspendHistory exclude karo
    const user = await SocialUser.findById(payload.id).select(
      "-password -otp -suspendHistory -refreshToken -passwordChangedAt"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        code:    "USER_NOT_FOUND",
        message: "User no longer exists",
      });
    }

    // Soft delete check
    if (user.isDeleted) {
      return res.status(401).json({
        success: false,
        code:    "ACCOUNT_DELETED",
        message: "This account has been deactivated",
      });
    }

    // Suspension check — virtual isSuspensionActive use karo
    if (user.isSuspended && user.isSuspensionActive) {
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: user.suspendUntil        // ✅ suspendUntil — naya model field name
          ? `Account suspended until ${user.suspendUntil.toISOString()}`
          : "Your account is suspended. Contact admin.",
      });
    }

    // Password change ke baad purana token reject karo
    // passwordChangedAt chahiye isliye alag query
    const userWithPwdDate = await SocialUser.findById(payload.id)
      .select("+passwordChangedAt")
      .lean();

    if (userWithPwdDate?.passwordChangedAt) {
      const changedAt = Math.floor(userWithPwdDate.passwordChangedAt.getTime() / 1000);
      if (payload.iat < changedAt) {
        return res.status(401).json({
          success: false,
          code:    "PASSWORD_CHANGED",
          message: "Password recently changed. Please login again.",
        });
      }
    }

    // lastSeen update karo — non-blocking
    SocialUser.findByIdAndUpdate(user._id, { lastSeen: new Date() }).exec();

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Role guards
// ─────────────────────────────────────────────────────────────────────────────

export const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      code:    "FORBIDDEN",
      message: "Super admin access required",
    });
  }
  next();
};

export const adminOnly = (req, res, next) => {
  if (!["super_admin", "admin"].includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      code:    "FORBIDDEN",
      message: "Admin access required",
    });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// optionalProtect — public routes jahan login optional ho
// ─────────────────────────────────────────────────────────────────────────────

export const optionalProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return next();

    const token   = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);
    if (!payload) return next();

    const user = await SocialUser.findById(payload.id).select(
      "-password -otp -suspendHistory -refreshToken"
    );

    if (user && !user.isDeleted && !user.isSuspended) {
      req.user = user;
    }

    next();
  } catch {
    next();
  }
};