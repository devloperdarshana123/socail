// module.exports = (io, socket) => {
//   // Follow request
//   socket.on("send_follow_request", ({ to }) => {
//     if (to === socket.user.id) return;
//     io.to(to).emit("follow_request_received", {
//       from: socket.user.id,
//       timestamp: new Date(),
//     });
//   });

//   // Follow accept
//   socket.on("follow_accepted", ({ to }) => {
//     if (to === socket.user.id) return;
//     io.to(to).emit("follow_request_accepted", {
//       from: socket.user.id,
//       timestamp: new Date(),
//     });
//   });

//   // Like notification
//   socket.on("send_like", ({ to, postId }) => {
//     if (to === socket.user.id) return;
//     io.to(to).emit("post_liked", {
//       from: socket.user.id,
//       postId,
//       timestamp: new Date(),
//     });
//   });

//   // Comment notification
//   socket.on("send_comment", ({ to, postId }) => {
//     if (to === socket.user.id) return;
//     io.to(to).emit("post_commented", {
//       from: socket.user.id,
//       postId,
//       timestamp: new Date(),
//     });
//   });
// };



const Notification = require("../models/Notification");

module.exports = (io, socket) => {
  const userId = socket.user.id || socket.user._id?.toString();

  // ── Follow request ──
  socket.on("send_follow_request", async ({ to }) => {
    if (!to || to === userId) return;

    try {
      await Notification.create({
        recipient: to,
        sender: userId,
        type: "follow_request",
      });

      io.to(to).emit("follow_request_received", {
        from: userId,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("❌ Follow request notification error:", err);
    }
  });

  // ── Follow accept ──
  socket.on("follow_accepted", async ({ to }) => {
    if (!to || to === userId) return;

    try {
      await Notification.create({
        recipient: to,
        sender: userId,
        type: "follow_accepted",
      });

      io.to(to).emit("follow_request_accepted", {
        from: userId,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("❌ Follow accept notification error:", err);
    }
  });

  // ── Like ──
  socket.on("send_like", async ({ to, postId }) => {
    if (!to || !postId || to === userId) return;

    try {
      await Notification.create({
        recipient: to,
        sender: userId,
        type: "like",
        post: postId,
      });

      io.to(to).emit("post_liked", {
        from: userId,
        postId,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("❌ Like notification error:", err);
    }
  });

  // ── Comment ──
  socket.on("send_comment", async ({ to, postId }) => {
    if (!to || !postId || to === userId) return;

    try {
      await Notification.create({
        recipient: to,
        sender: userId,
        type: "comment",
        post: postId,
      });

      io.to(to).emit("post_commented", {
        from: userId,
        postId,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("❌ Comment notification error:", err);
    }
  });
};