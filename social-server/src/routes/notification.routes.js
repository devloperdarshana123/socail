import express from "express";
import { getNotifications, markAllRead } from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/",        protect, getNotifications);
router.put("/read-all", protect, markAllRead);

export default router;