// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const dotenv = require("dotenv");
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

// // Main server follow notification ke liye
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

// // Main server message notification ke liye
// app.post("/notify/message", (req, res) => {
//   const { to, message } = req.body;
//   const io = getIO();
//   io.to(to).emit("receive_message", message);
//   res.json({ success: true });
// });

// app.get("/health", (req, res) => res.json({ status: "Chat server running ✅" }));

// const server = http.createServer(app);
// initSocket(server);

// server.listen(process.env.PORT || 5001, () => {
//   console.log(`Chat server running on port ${process.env.PORT}`);
// });


const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { initSocket, getIO } = require("./socket");

dotenv.config();

const app = express();

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

const internalAuth = (req, res, next) => {
  const secret = req.headers["x-internal-secret"];
  if (secret !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  next();
};

app.post("/notify/follow", (req, res) => {
  const { to, from } = req.body;
  const io = getIO();
  io.to(to).emit("follow_request_received", { from });
  res.json({ success: true });
});

app.post("/notify/message", (req, res) => {
  const { to, message } = req.body;
  const io = getIO();
  io.to(to).emit("receive_message", message);
  res.json({ success: true });
});

app.get("/health", (req, res) => res.json({ status: "Chat server running ✅" }));

const server = http.createServer(app);
initSocket(server);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(process.env.PORT || 5001, () => {
      console.log(`Chat server running on port ${process.env.PORT || 5001}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });