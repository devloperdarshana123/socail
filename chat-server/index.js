

// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const dotenv = require("dotenv");
// const mongoose = require("mongoose");
// const Notification = require("./models/Notification");
// const { initSocket, getIO } = require("./socket");

// dotenv.config();

// const app = express();

// const ALLOWED_ORIGINS = process.env.CLIENT_URL
//   ? process.env.CLIENT_URL.split(",")
//   : ["http://localhost:5173", "http://localhost:5174"];

// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin || ALLOWED_ORIGINS.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true,
// }));

// app.use(express.json());

// const internalAuth = (req, res, next) => {
//   const secret = req.headers["x-internal-secret"];
//   if (secret !== process.env.INTERNAL_SECRET) {
//     return res.status(403).json({ message: "Unauthorized" });
//   }
//   next();
// };

// app.post("/notify/follow", (req, res) => {
//   const { to, from } = req.body;
//   const io = getIO();
//   io.to(to).emit("follow_request_received", { from });
//   res.json({ success: true });
// });

// app.post("/notify/message", (req, res) => {
//   const { to, message } = req.body;
//   const io = getIO();
//   io.to(to).emit("receive_message", message);
//   res.json({ success: true });
// });

// app.post("/notify/comment", internalAuth, async (req, res) => {
//   const { to, from, fromName, fromAvatar, postId, type, text } = req.body;
//   try {
//     await Notification.create({
//       recipient: to,
//       sender: from,
//       type,
//       post: postId,
//       text,
//     });
//     const io = getIO();
//     io.to(to).emit("new_notification", { from, fromName, fromAvatar, postId, type, text });
//     res.json({ success: true });
//   } catch (err) {
//     console.error("Notification save error:", err);
//     res.status(500).json({ success: false });
//   }
// });
// app.get("/health", (req, res) => res.json({ status: "Chat server running ✅" }));

// const server = http.createServer(app);
// initSocket(server);

// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => {
//     console.log("✅ MongoDB connected");
//     server.listen(process.env.PORT || 5001, () => {
//       console.log(`Chat server running on port ${process.env.PORT || 5001}`);
//     });
//   })
//   .catch((err) => {
//     console.error("❌ MongoDB connection error:", err);
//     process.exit(1);
//   });



const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Notification = require("./models/Notification");
const { initSocket, getIO } = require("./socket");

dotenv.config();

const app = express();

// ── CORS ──
const ALLOWED_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",")
  : ["http://localhost:5173", "http://localhost:5174"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(express.json());

// ── Internal Auth Middleware ──
const internalAuth = (req, res, next) => {
  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  next();
};

// ── Routes ──
app.post("/notify/follow", internalAuth, (req, res) => {
  const { to, from } = req.body;

  if (!to || !from) {
    return res.status(400).json({ message: "Missing required fields: to, from" });
  }

  const io = getIO();
  io.to(to).emit("follow_request_received", { from });
  res.json({ success: true });
});

app.post("/notify/message", internalAuth, (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ message: "Missing required fields: to, message" });
  }

  const io = getIO();
  io.to(to).emit("receive_message", message);
  res.json({ success: true });
});

app.post("/notify/comment", internalAuth, async (req, res) => {
  const { to, from, fromName, fromAvatar, postId, type, text } = req.body;

  if (!to || !from || !type) {
    return res.status(400).json({ message: "Missing required fields: to, from, type" });
  }

  try {
    await Notification.create({
      recipient: to,
      sender: from,
      type,
      post: postId,
      text,
    });

    const io = getIO();
    io.to(to).emit("new_notification", { from, fromName, fromAvatar, postId, type, text });
    res.json({ success: true });
  } catch (err) {
    console.error("Notification save error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/health", (req, res) => res.json({ status: "Chat server running ✅" }));

// ── Server Setup ──
const server = http.createServer(app);
initSocket(server);

// ── MongoDB ──
mongoose.connection.on("disconnected", () => {
  console.error("❌ MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err);
});

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

// ── Graceful Shutdown ──
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down gracefully");
  await mongoose.connection.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received — shutting down gracefully");
  await mongoose.connection.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});