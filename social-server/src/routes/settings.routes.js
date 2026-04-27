// import express from "express";
// import multer from "multer";
// import { protect } from "../middleware/auth.middleware.js";
// import {
//   updateProfile,
//   changePassword,
//   deactivateAccount,
//   uploadAvatar,
//   removeAvatar,
//   uploadCoverPhoto
// } from "../controllers/settings.controller.js";

// const router = express.Router();
// const upload = multer({ dest: "uploads/" });

// router.put("/profile",         protect, updateProfile);
// router.put("/change-password", protect, changePassword);
// router.delete("/deactivate",   protect, deactivateAccount);
// router.post("/avatar",         protect, upload.single("avatar"), uploadAvatar);
// router.delete("/avatar",       protect, removeAvatar);
// router.put("/cover", protect, upload.single("cover"), uploadCoverPhoto);

// export default router;




import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.middleware.js";
import {
  updateProfile,
  changePassword,
  setPassword,
  deactivateAccount,
  uploadAvatar,
  removeAvatar,
  uploadCoverPhoto
} from "../controllers/settings.controller.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.put("/profile",         protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.post("/set-password",   protect, setPassword);
router.delete("/deactivate",   protect, deactivateAccount);
router.post("/avatar",         protect, upload.single("avatar"), uploadAvatar);
router.delete("/avatar",       protect, removeAvatar);
router.put("/cover",           protect, upload.single("cover"), uploadCoverPhoto);

export default router;