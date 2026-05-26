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
  blockUser,      // ← ADD
  unblockUser,    // ← ADD
  getBlockedUsers ,
  getBlockStatus ,
  submitReport
} from "../../controllers/auth/user.controller.js";

const userRouter = express.Router();



// ── All routes require authentication ──
userRouter.use(isAuthenticated, isActive);
userRouter.get("/map-sellers", getMapSellers);
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
userRouter
  .route("/block/:userId")
  .post(blockUser)    // block karo
  .delete(unblockUser); // unblock karo



userRouter.get("/blocked", getBlockedUsers); // blocked list
userRouter.get("/block-status/:userId", getBlockStatus);
userRouter.post("/report", submitReport);

// ─────────────────────────────────────────────
//  Map Sellers Route
// ─────────────────────────────────────────────


export default userRouter;