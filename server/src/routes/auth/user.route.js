import express from "express";
import { isAuthenticated, isActive} from "../../middlewares/auth.js";
import { uploadSingle } from "../../middlewares/Multer.middleware.js";
import {
  updateAvatar,
  updateCoverPhoto,
  removeAvatar,
  removeCoverPhoto,
  updateProfile,
  getMapSellers, 
} from "../../controllers/auth/user.controller.js";

const userRouter = express.Router();

userRouter.get("/map-sellers", getMapSellers);

// ── All routes require authentication ──
userRouter.use(isAuthenticated, isActive);

// ─────────────────────────────────────────────
//  Avatar Routes
// ─────────────────────────────────────────────
userRouter
  .route("/avatar")
  .patch(uploadSingle("avatar"), updateAvatar)   // upload/replace
  .delete(removeAvatar);                          // remove

// ─────────────────────────────────────────────
//  Cover Photo Routes
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
//  Profile Update
// ─────────────────────────────────────────────
userRouter.patch("/profile", updateProfile);
userRouter
  .route("/cover-photo")
  .patch(uploadSingle("coverPhoto"), updateCoverPhoto)  // upload/replace
  .delete(removeCoverPhoto);                             // remove

// ─────────────────────────────────────────────
//  Map Sellers Route
// ─────────────────────────────────────────────


export default userRouter;