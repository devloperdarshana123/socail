import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import { uploadRateLimiter } from "../../middlewares/rateLimiter.js";
import { getUploadSignature } from "../../controllers/auth/upload.controller.js";

const router = express.Router();

router.use(isAuthenticated, isActive);

router.get("/signature", uploadRateLimiter, getUploadSignature);

export default router;
