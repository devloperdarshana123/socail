module.exports = (io, socket) => {
  // Follow request
  socket.on("send_follow_request", ({ to }) => {
    if (to === socket.user.id) return;
    io.to(to).emit("follow_request_received", {
      from: socket.user.id,
      timestamp: new Date(),
    });
  });

  // Follow accept
  socket.on("follow_accepted", ({ to }) => {
    if (to === socket.user.id) return;
    io.to(to).emit("follow_request_accepted", {
      from: socket.user.id,
      timestamp: new Date(),
    });
  });

  // Like notification
  socket.on("send_like", ({ to, postId }) => {
    if (to === socket.user.id) return;
    io.to(to).emit("post_liked", {
      from: socket.user.id,
      postId,
      timestamp: new Date(),
    });
  });

  // Comment notification
  socket.on("send_comment", ({ to, postId }) => {
    if (to === socket.user.id) return;
    io.to(to).emit("post_commented", {
      from: socket.user.id,
      postId,
      timestamp: new Date(),
    });
  });
};