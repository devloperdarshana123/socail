
// import Notification from "../../models/Notification.js";
// import { fetchSender } from "./userService.js";
// import { getIO } from "../socket/index.js";
// import logger from "../utils/logger.js";

// const labelMap = {
//   post_like:               "liked your post",
//   post_comment:            "commented on your post",
//   comment_like:            "liked your comment",
//   comment_reply:           "replied to your comment",
//   follow:                  "started following you",
//   follow_request:          "sent you a follow request",
//   follow_request_accepted: "accepted your follow request",
//   story_reaction:          "reacted to your story",
//   new_message:             "sent you a message",
//   admin_new_user:          "New user registered",
//   admin_new_report:        "New report submitted",
// };

// // ── User notifications ────────────────────────────────────────────────────────
// export const emitNotification = async ({ to, from, type, refId = null, refModel = null, meta = {} }) => {
//   if (!to || !from || to.toString() === from.toString()) return;

//   try {
//     const io    = getIO();
//     const saved = await Notification.createNotification({ receiver: to, sender: from, type, refId, refModel, meta });
//     if (!saved) return;

//     const sender  = await fetchSender(from);
//     const payload = {
//       _id:      saved._id,
//       type,
//       label:    labelMap[type] || type,
//       sender,
//       receiver: to.toString(),
//       refId:    saved.refId    ?? null,
//       refModel: saved.refModel ?? null,
//       meta:     saved.meta     ?? {},
//       isRead:   false,
//       createdAt: saved.createdAt,
//     };

//     io.to(to.toString()).emit("notification:new", payload);
//     logger.info(`🔔 notification:new → ${to} [${type}]`);
//   } catch (err) {
//     logger.error("❌ emitNotification failed", { type, error: err.message });
//   }
// };

// // ── Admin notifications ───────────────────────────────────────────────────────
// export const emitAdminNotification = async ({ type, meta = {} }) => {
//   try {
//     const io = getIO();

//     const payload = {
//       type,
//       label: labelMap[type] || type,
//       meta,
//       isRead:    false,
//       createdAt: new Date(),
//     };

//     io.of("/admin").to("admin_room").emit("admin:notification", payload);
//     logger.info(`🔔 admin:notification [${type}]`, { meta });
//   } catch (err) {
//     logger.error("❌ emitAdminNotification failed", { type, error: err.message });
//   }
// };



import Notification from "../../models/Notification.js";
import { fetchSender } from "./userService.js";
import { getIO } from "../socket/index.js";
import logger from "../utils/logger.js";

const labelMap = {
  post_like:               "liked your post",
  post_comment:            "commented on your post",
  comment_like:            "liked your comment",
  comment_reply:           "replied to your comment",
  follow:                  "started following you",
  follow_request:          "sent you a follow request",
  follow_request_accepted: "accepted your follow request",
  story_reaction:          "reacted to your story",
  new_message:             "sent you a message",
  admin_new_user:          "New user registered",
  admin_new_report:        "New report submitted",
};

const MAIN_SERVER_URL      = process.env.MAIN_SERVER_URL;
const CHAT_INTERNAL_SECRET = process.env.CHAT_INTERNAL_SECRET;

// ── User notifications ────────────────────────────────────────────────────────
export const emitNotification = async ({ to, from, type, refId = null, refModel = null, meta = {} }) => {
  if (!to || !from || to.toString() === from.toString()) return;

  try {
    const io    = getIO();
    const saved = await Notification.createNotification({ receiver: to, sender: from, type, refId, refModel, meta });
    if (!saved) return;

    const sender  = await fetchSender(from);
    const payload = {
      _id:      saved._id,
      type,
      label:    labelMap[type] || type,
      sender,
      receiver: to.toString(),
      refId:    saved.refId    ?? null,
      refModel: saved.refModel ?? null,
      meta:     saved.meta     ?? {},
      isRead:   false,
      createdAt: saved.createdAt,
    };

    io.to(to.toString()).emit("notification:new", payload);
    logger.info(`🔔 notification:new → ${to} [${type}]`);
  } catch (err) {
    logger.error("❌ emitNotification failed", { type, error: err.message });
  }
};

// ── Admin notifications ───────────────────────────────────────────────────────
export const emitAdminNotification = async ({ type, meta = {} }) => {
  try {
    const io = getIO();

    const payload = {
      type,
      label:     labelMap[type] || type,
      meta,
      isRead:    false,
      createdAt: new Date(),
    };

    // 1. Live admins ko emit karo
    io.of("/admin").to("admin_room").emit("admin:notification", payload);
    logger.info(`🔔 admin:notification emitted [${type}]`, { meta });

    // 2. DB mein persist karo — main server ke through
    if (!MAIN_SERVER_URL || !CHAT_INTERNAL_SECRET) {
      logger.warn("emitAdminNotification: MAIN_SERVER_URL or CHAT_INTERNAL_SECRET not set — skipping persist");
      return;
    }

    const res = await fetch(`${MAIN_SERVER_URL}/api/v2/admin/notifications/save`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-internal-secret": CHAT_INTERNAL_SECRET,
      },
      body: JSON.stringify({ type, meta }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error("emitAdminNotification: persist failed", { status: res.status, body });
    }

  } catch (err) {
    logger.error("❌ emitAdminNotification failed", {
      type,
      error: err.message,
      stack: err.stack,
    });
  }
};