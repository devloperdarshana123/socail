// import express from "express";
// import { getNotifications, markAllRead } from "../controllers/notification.controller.js";
// import { protect } from "../middleware/auth.middleware.js";

// const router = express.Router();

// router.get("/",        protect, getNotifications);
// router.put("/read-all", protect, markAllRead);

// export default router;


import express from "express";
import { protect } from "../middleware/auth.middleware.js";

import {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get   ("/",             protect, getNotifications);    // ?page=1&unreadOnly=true
router.get   ("/unread-count", protect, getUnreadCount);      // badge ke liye
router.put   ("/read-all",      protect, markAllRead);
router.put   ("/:notifId/read", protect, markRead);
router.delete("/:notifId",     protect, deleteNotification);
router.delete("/",             protect, deleteAllNotifications);

export default router;