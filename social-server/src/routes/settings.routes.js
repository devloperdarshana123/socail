
import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.middleware.js";

import {
  getProfile,
   getMyProfile, 
  updateProfile,
  uploadAvatar,
  uploadCoverPhoto,
   removeAvatar,  
  changePassword,
  updateLocation,
  deactivateAccount,
} from "../controllers/settings.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });   // buffer — Cloudinary ke liye

// ── Profile ───────────────────────────────────────────────────────────────────
router.get ("/profile/:username",  protect, getProfile);
router.put ("/profile",            protect, updateProfile);
router.get("/profile", protect, getMyProfile);

// ── Media ─────────────────────────────────────────────────────────────────────
router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);
router.delete("/avatar", protect, removeAvatar);
router.post("/cover", protect, upload.single("cover"), uploadCoverPhoto);
router.put ("/cover", protect, upload.single("cover"), uploadCoverPhoto); 

// ── Security ──────────────────────────────────────────────────────────────────
router.put   ("/change-password", protect, changePassword);
router.delete("/deactivate",      protect, deactivateAccount);

// ── Location ──────────────────────────────────────────────────────────────────
router.put("/location", protect, updateLocation);

export default router;