

// // chat-server/index.js
// import express from "express";
// import http from "http";
// import cors from "cors";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import rateLimit from "express-rate-limit";
// import helmet from "helmet";
// import Notification from "./models/Notification.js";
// import User from "./models/User.js";
// import { initSocket, getIO } from "./socket/index.js";

// dotenv.config();

// const app = express();

// // ── CORS ──
// const ALLOWED_ORIGINS = process.env.CLIENT_URL
//   ? process.env.CLIENT_URL.split(",")
//   : ["http://localhost:5173", "http://localhost:5174"];

// app.use(helmet());
// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
//     else callback(new Error("Not allowed by CORS"));
//   },
//   credentials: true,
// }));
// app.use(express.json());
// app.use(rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: "Too many requests, please try again later.",
// }));

// // ── Internal Auth ──
// const internalAuth = (req, res, next) => {
//   const secret = req.headers["x-internal-secret"];
//   if (!secret || secret !== process.env.INTERNAL_SECRET) {
//     return res.status(403).json({ message: "Unauthorized" });
//   }
//   next();
// };

// // ── Label map ──
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
// };

// // ── Helper: sender fetch karo direct collection se ──
// const fetchSender = async (senderId) => {
//   try {
//     const oid = new mongoose.Types.ObjectId(senderId);

//     // Pehle User model se try karo
//     let sender = await User.findById(oid)
//       .select("_id username fullName avatar isVerifiedBadge")
//       .lean();

//     // Agar model miss kare — direct collection query
//     if (!sender) {
//       const db = mongoose.connection.db;
//       for (const col of ["socialusers", "users"]) {
//         const doc = await db.collection(col).findOne(
//           { _id: oid },
//           { projection: { _id: 1, username: 1, fullName: 1, avatar: 1, isVerifiedBadge: 1 } }
//         );
//         if (doc) { sender = doc; break; }
//       }
//     }
//     return sender || { _id: senderId, fullName: null, username: null, avatar: null };
//   } catch {
//     return { _id: senderId, fullName: null, username: null, avatar: null };
//   }
// };

// // ── Helper: notification:new emit karo properly ──
// // Yahi ek jagah se emit hona chahiye — duplicate avoid ke liye
// const emitNotification = async ({ to, from, type, refId = null, refModel = null, meta = {} }) => {
//   // Self-notification skip
//   if (!to || !from || to.toString() === from.toString()) return;

//   const io = getIO();

//   // DB save
//   const saved = await Notification.createNotification({
//     receiver: to, sender: from, type, refId, refModel, meta,
//   });

//   // Deduped — already sent recently
//   if (!saved) return;

//   // Sender fetch
//   const sender = await fetchSender(from);

//   // Sirf notification:new emit — koi alag event nahi
//   const payload = {
//     _id:      saved._id,
//     type,
//     label:    labelMap[type] || type,
//     sender,
//     receiver: to.toString(),
//     refId:    saved.refId   ?? null,
//     refModel: saved.refModel ?? null,
//     meta:     saved.meta    ?? {},
//     isRead:   false,
//     createdAt: saved.createdAt,
//   };

//   io.to(to.toString()).emit("notification:new", payload);
//   console.log(`🔔 [HTTP route] notification:new → ${to} [${type}] sender: ${sender.fullName || sender.username || "unknown"}`);
// };

// // ────────────────────────────────────────────────────────────────────────────
// // Routes
// // IMPORTANT: Yeh routes sirf DB save + emit karte hain
// // Koi alag "post_commented", "post_liked", "follow_request_received" emit NAHI
// // Woh sab notificationHandler.js socket events se handle hote the — ab band
// // ────────────────────────────────────────────────────────────────────────────

// // /notify/follow — public account follow ya private request
// app.post("/notify/follow", internalAuth, async (req, res) => {
//   const { to, from, type } = req.body;
//   // type = "follow" (public) ya "follow_request" (private) — main server se aata hai
//   if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });

//   try {
//     const notifType = type === "follow" ? "follow" : "follow_request";
//     await emitNotification({ to, from, type: notifType });
//     res.json({ success: true });
//   } catch (err) {
//     console.error("❌ /notify/follow error:", err.message);
//     res.status(500).json({ success: false });
//   }
// });

// // /notify/follow-accepted — follow request accept hone pe
// app.post("/notify/follow-accepted", internalAuth, async (req, res) => {
//   const { to, from } = req.body;
//   if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });

//   try {
//     await emitNotification({ to, from, type: "follow_request_accepted" });
//     res.json({ success: true });
//   } catch (err) {
//     console.error("❌ /notify/follow-accepted error:", err.message);
//     res.status(500).json({ success: false });
//   }
// });

// // /notify/comment
// app.post("/notify/comment", internalAuth, async (req, res) => {
//   const { to, from, postId, text } = req.body;
//   if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });

//   try {
//     await emitNotification({
//       to, from, type: "post_comment",
//       refId: postId || null,
//       refModel: postId ? "Post" : null,
//       meta: { preview: text?.slice(0, 100) || null },
//     });
//     res.json({ success: true });
//   } catch (err) {
//     console.error("❌ /notify/comment error:", err.message);
//     res.status(500).json({ success: false });
//   }
// });

// // /notify/like
// app.post("/notify/like", internalAuth, async (req, res) => {
//   const { to, from, postId } = req.body;
//   if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });

//   try {
//     await emitNotification({
//       to, from, type: "post_like",
//       refId: postId || null,
//       refModel: postId ? "Post" : null,
//     });
//     res.json({ success: true });
//   } catch (err) {
//     console.error("❌ /notify/like error:", err.message);
//     res.status(500).json({ success: false });
//   }
// });

// // /notify/message — sirf socket emit, DB save nahi (message notifications alag handle hoti hain)
// app.post("/notify/message", internalAuth, (req, res) => {
//   const { to, message } = req.body;
//   if (!to || !message) return res.status(400).json({ message: "Missing: to, message" });

//   const io = getIO();
//   io.to(to).emit("receive_message", message);
//   res.json({ success: true });
// });

// app.get("/health", (_req, res) => res.json({ status: "Chat server running ✅" }));

// // ── Server Setup ──
// const server = http.createServer(app);
// initSocket(server);

// mongoose.connection.on("disconnected", () => console.error("❌ MongoDB disconnected"));
// mongoose.connection.on("error", (err) => console.error("❌ MongoDB error:", err));

// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => {
//     console.log("✅ MongoDB connected");
//     server.listen(process.env.PORT || 5001, () => {
//       console.log(`🚀 Chat server running on port ${process.env.PORT || 5001}`);
//     });
//   })
//   .catch((err) => {
//     console.error("❌ MongoDB connection error:", err);
//     process.exit(1);
//   });

// process.on("SIGTERM", async () => {
//   await mongoose.connection.close();
//   server.close(() => process.exit(0));
// });

// process.on("SIGINT", async () => {
//   await mongoose.connection.close();
//   server.close(() => process.exit(0));
// });



// chat-server/index.js
import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import Notification from "./models/Notification.js";
import User from "./models/User.js";
import { initSocket, getIO } from "./socket/index.js";

dotenv.config();

const app = express();

// ── CORS ──
const ALLOWED_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",")
  : ["http://localhost:5173", "http://localhost:5174"];

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
}));

// ── Internal Auth ──
const internalAuth = (req, res, next) => {
  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  next();
};

// ── Label map ──
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

// ── Helper: sender fetch karo direct collection se ──
const fetchSender = async (senderId) => {
  try {
    const oid = new mongoose.Types.ObjectId(senderId);

    let sender = await User.findById(oid)
      .select("_id username fullName avatar isVerifiedBadge")
      .lean();

    if (!sender) {
      const db = mongoose.connection.db;
      for (const col of ["socialusers", "users"]) {
        const doc = await db.collection(col).findOne(
          { _id: oid },
          { projection: { _id: 1, username: 1, fullName: 1, avatar: 1, isVerifiedBadge: 1 } }
        );
        if (doc) { sender = doc; break; }
      }
    }
    return sender || { _id: senderId, fullName: null, username: null, avatar: null };
  } catch {
    return { _id: senderId, fullName: null, username: null, avatar: null };
  }
};

// ── Helper: notification:new emit ──
const emitNotification = async ({ to, from, type, refId = null, refModel = null, meta = {} }) => {
  if (!to || !from || to.toString() === from.toString()) return;

  const io = getIO();

  const saved = await Notification.createNotification({
    receiver: to, sender: from, type, refId, refModel, meta,
  });

  if (!saved) return;

  const sender = await fetchSender(from);

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
  console.log(`🔔 [HTTP route] notification:new → ${to} [${type}] sender: ${sender.fullName || sender.username || "unknown"}`);
};

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

// /notify/follow
app.post("/notify/follow", internalAuth, async (req, res) => {
  const { to, from, type } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({ to, from, type: type === "follow" ? "follow" : "follow_request" });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ /notify/follow error:", err.message);
    res.status(500).json({ success: false });
  }
});

// /notify/follow-accepted
app.post("/notify/follow-accepted", internalAuth, async (req, res) => {
  const { to, from } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({ to, from, type: "follow_request_accepted" });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ /notify/follow-accepted error:", err.message);
    res.status(500).json({ success: false });
  }
});

// /notify/comment
app.post("/notify/comment", internalAuth, async (req, res) => {
  const { to, from, postId, text } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({
      to, from, type: "post_comment",
      refId:    postId || null,
      refModel: postId ? "Post" : null,
      meta:     { preview: text?.slice(0, 100) || null },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ /notify/comment error:", err.message);
    res.status(500).json({ success: false });
  }
});

// /notify/like
app.post("/notify/like", internalAuth, async (req, res) => {
  const { to, from, postId } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({
      to, from, type: "post_like",
      refId:    postId || null,
      refModel: postId ? "Post" : null,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ /notify/like error:", err.message);
    res.status(500).json({ success: false });
  }
});

// /notify/story-reaction — story like/react pe
app.post("/notify/story-reaction", internalAuth, async (req, res) => {
  const { to, from, storyId, reaction } = req.body;
  if (!to || !from) return res.status(400).json({ message: "Missing: to, from" });
  try {
    await emitNotification({
      to, from, type: "story_reaction",
      refId:    storyId || null,
      refModel: storyId ? "Story" : null,
      meta:     { reaction: reaction || "❤️" },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ /notify/story-reaction error:", err.message);
    res.status(500).json({ success: false });
  }
});

// /notify/message
app.post("/notify/message", internalAuth, (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ message: "Missing: to, message" });
  const io = getIO();
  io.to(to).emit("receive_message", message);
  res.json({ success: true });
});

app.get("/health", (_req, res) => res.json({ status: "Chat server running ✅" }));

// ── Server Setup ──
const server = http.createServer(app);
initSocket(server);

mongoose.connection.on("disconnected", () => console.error("❌ MongoDB disconnected"));
mongoose.connection.on("error", (err) => console.error("❌ MongoDB error:", err));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(process.env.PORT || 5001, () => {
      console.log(`🚀 Chat server running on port ${process.env.PORT || 5001}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  await mongoose.connection.close();
  server.close(() => process.exit(0));
});

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  server.close(() => process.exit(0));
});