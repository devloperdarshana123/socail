// src/services/notificationService.js
import Notification from "../../models/Notification.js";
import { fetchSender } from "./userService.js";
import { getIO } from "../socket/index.js";

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
};

export const emitNotification = async ({ to, from, type, refId=null, refModel=null, meta={} }) => {
  if (!to || !from || to.toString() === from.toString()) return;

  const io     = getIO();
  const saved  = await Notification.createNotification({ receiver:to, sender:from, type, refId, refModel, meta });
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
};