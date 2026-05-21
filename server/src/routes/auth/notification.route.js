// server/src/routes/auth/notification.route.js

import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
  deleteNotification,
  clearAllNotifications,
} from "../../controllers/auth/notification.controller.js";
import { isAuthenticated } from "../../middlewares/auth.js"; // tumhara existing auth middleware

const router = express.Router();

// Sab routes protected hain
router.use(isAuthenticated);

router.get("/",           getNotifications);        // inbox
router.get("/count",      getUnreadCount);           // badge
router.put("/read",       markAllRead);              // mark all read
router.put("/:id/read",   markOneRead);              // mark one read
router.delete("/:id",     deleteNotification);       // delete one
router.delete("/",        clearAllNotifications);    // clear all

export default router;