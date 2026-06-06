// src/routes/notifyRoutes.js
import { Router } from "express";
import { internalAuth } from "../middleware/internalAuth.js";
import { emitNotification , emitAdminNotification } from "../services/notificationService.js";
import { getIO } from "../socket/index.js";

const router = Router();

router.post("/follow", internalAuth, async (req, res) => {
  const { to, from, type } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({ to, from, type: type === "follow" ? "follow" : "follow_request" });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

router.post("/follow-accepted", internalAuth, async (req, res) => {
  const { to, from } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({ to, from, type: "follow_request_accepted" });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

router.post("/comment", internalAuth, async (req, res) => {
  const { to, from, postId, text } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({ to, from, type: "post_comment",
      refId: postId||null, refModel: postId?"Post":null,
      meta: { preview: text?.slice(0,100)||null },
    });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

router.post("/like", internalAuth, async (req, res) => {
  const { to, from, postId } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({ to, from, type:"post_like",
      refId: postId||null, refModel: postId?"Post":null,
    });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

router.post("/story-reaction", internalAuth, async (req, res) => {
  const { to, from, storyId, reaction } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({ to, from, type:"story_reaction",
      refId: storyId||null, refModel: storyId?"Story":null,
      meta: { reaction: reaction||"❤️" },
    });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

router.post("/message", internalAuth, (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ message: "Missing: to, message" });
  const io = getIO();
  io.to(to).emit("receive_message", message);
  res.json({ success: true });
});


router.post("/admin-notify", internalAuth, async (req, res) => {
  const { type, meta = {} } = req.body;
  if (!type) return res.status(400).json({ message: "Missing: type" });
  try {
    await emitAdminNotification({ type, meta });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

export default router;