
// // // // import Notification from "../models/Notification.js";
// // // // import User from "../models/User.js";

// // // // export default (io, socket) => {
// // // //   const userId = (socket.user.id || socket.user._id)?.toString();

// // // //   // User apne userId room mein join karo
// // // //   socket.join(userId);
// // // //   console.log(`🔔 Notification room joined: ${userId}`);

// // // //   // ── Core helper ──────────────────────────────────────────────────────────
// // // //   // DB mein save karo + online hone pe real-time emit karo
// // // //   // Dono operations independent hain — ek fail hone pe dusra chalta rahe
// // // //   // ─────────────────────────────────────────────────────────────────────────
// // // //   const notify = async ({ to, type, refId = null, refModel = null, meta = {} }) => {
// // // //     if (!to || to === userId) return;

// // // //     let savedNotification = null;

// // // //     // ── Step 1: DB mein save (offline users ke liye bhi milega) ──────────
// // // //     try {
// // // //       savedNotification = await Notification.createNotification({
// // // //         receiver: to,       // server model mein 'receiver' hai, 'recipient' nahi
// // // //         sender: userId,
// // // //         type,
// // // //         refId,
// // // //         refModel,
// // // //         meta,
// // // //       });

// // // //       // Dedup — same notification 60s mein already bhi ho sakti hai
// // // //       if (!savedNotification) {
// // // //         console.log(`⏭️ Notification deduped: ${type} → ${to}`);
// // // //         return;
// // // //       }
// // // //     } catch (err) {
// // // //       // DB fail hone pe bhi real-time emit try karo (best-effort)
// // // //       console.error(`❌ Notification DB save failed [${type}]:`, err.message);
// // // //     }

// // // //     // ── Step 2: Real-time emit ────────────────────────────────────────────
// // // //     try {
// // // //       const sender = await User.findById(userId)
// // // //         .select("username fullName avatar isVerifiedBadge")
// // // //         .lean();

// // // //       // Event name map — frontend isse sun raha hai
// // // //       const eventMap = {
// // // //         follow_request:           "follow_request_received",
// // // //         follow_request_accepted:  "follow_request_accepted",
// // // //         follow:                   "follow_received",
// // // //         post_like:                "post_liked",
// // // //         post_comment:             "post_commented",
// // // //         comment_reply:            "comment_replied",
// // // //         comment_like:             "comment_liked",
// // // //         story_reaction:           "story_reacted",
// // // //         story_reply:              "story_replied",
// // // //       };

// // // //       const event = eventMap[type];
// // // //       if (!event) return;

// // // //       // Notification object emit karo — client seedha list mein add kar sake
// // // //       io.to(to).emit(event, {
// // // //         notification: savedNotification, // poori notification object — id, type, sender, refId, meta
// // // //         sender,
// // // //         timestamp: new Date(),
// // // //       });

// // // //       // Badge ke liye unread count bhi bhejo — client ko alag query nahi karni padegi
// // // //       const unreadCount = await Notification.getUnreadCount(to);
// // // //       io.to(to).emit("notification:unread_count", { count: unreadCount });

// // // //       console.log(`🔔 Notification emitted: ${type} → ${to}`);
// // // //     } catch (err) {
// // // //       console.error(`❌ Notification emit failed [${type}]:`, err.message);
// // // //     }
// // // //   };

// // // //   // ── Socket Events ─────────────────────────────────────────────────────────

// // // //   // Follow request
// // // //   socket.on("send_follow_request", ({ to }) => {
// // // //     notify({ to, type: "follow_request" });
// // // //   });

// // // //   // Follow request accept
// // // //   socket.on("follow_accepted", ({ to }) => {
// // // //     notify({ to, type: "follow_request_accepted" });
// // // //   });

// // // //   // Direct follow (public account)
// // // //   socket.on("send_follow", ({ to }) => {
// // // //     notify({ to, type: "follow" });
// // // //   });

// // // //   // Post like
// // // //   socket.on("send_like", ({ to, postId }) => {
// // // //     if (!postId) return;
// // // //     notify({ to, type: "post_like", refId: postId, refModel: "Post" });
// // // //   });

// // // //   // Post comment
// // // //   socket.on("send_comment", ({ to, postId, preview = null }) => {
// // // //     if (!postId) return;
// // // //     notify({
// // // //       to,
// // // //       type: "post_comment",
// // // //       refId: postId,
// // // //       refModel: "Post",
// // // //       meta: { preview },
// // // //     });
// // // //   });

// // // //   // Comment reply
// // // //   socket.on("send_reply", ({ to, postId, commentId, preview = null }) => {
// // // //     notify({
// // // //       to,
// // // //       type: "comment_reply",
// // // //       refId: commentId || postId,
// // // //       refModel: "Comment",
// // // //       meta: { preview },
// // // //     });
// // // //   });

// // // //   // Comment like
// // // //   socket.on("send_comment_like", ({ to, commentId }) => {
// // // //     if (!commentId) return;
// // // //     notify({ to, type: "comment_like", refId: commentId, refModel: "Comment" });
// // // //   });

// // // //   // Story reaction
// // // //   socket.on("send_story_reaction", ({ to, storyId, reaction }) => {
// // // //     if (!storyId) return;
// // // //     notify({
// // // //       to,
// // // //       type: "story_reaction",
// // // //       refId: storyId,
// // // //       refModel: "Story",
// // // //       meta: { reaction },
// // // //     });
// // // //   });

// // // //   // ── Mark as read (from client) ────────────────────────────────────────────
// // // //   // Client ye emit kare jab user notifications panel khhole
// // // //   socket.on("notification:mark_read", async ({ notificationId }) => {
// // // //     try {
// // // //       if (notificationId === "all") {
// // // //         await Notification.markAllAsRead(userId);
// // // //       } else {
// // // //         await Notification.markAsRead(notificationId, userId);
// // // //       }

// // // //       // Updated unread count wapas bhejo
// // // //       const count = await Notification.getUnreadCount(userId);
// // // //       socket.emit("notification:unread_count", { count });
// // // //     } catch (err) {
// // // //       console.error("❌ Mark read failed:", err.message);
// // // //     }
// // // //   });

// // // //   // ── Delete notification (from client) ────────────────────────────────────
// // // //   socket.on("notification:delete", async ({ notificationId }) => {
// // // //     try {
// // // //       await Notification.softDelete(notificationId, userId);
// // // //       const count = await Notification.getUnreadCount(userId);
// // // //       socket.emit("notification:unread_count", { count });
// // // //     } catch (err) {
// // // //       console.error("❌ Notification delete failed:", err.message);
// // // //     }
// // // //   });
// // // // };




// // // // chat-server/socket/notificationHandler.js
// // // import Notification from "../models/Notification.js";
// // // import User from "../models/User.js";

// // // export default (io, socket) => {
// // //   const userId = (socket.user.id || socket.user._id)?.toString();

// // //   socket.join(userId);
// // //   console.log(`🔔 Notification room joined: ${userId}`);

// // //   // ─────────────────────────────────────────────────────────────────────────
// // //   // Core helper — DB save + real-time emit
// // //   // Production fixes:
// // //   //   1. sender properly populate hota hai — "Someone" nahi aayega
// // //   //   2. notification:new HAMESHA emit hota hai — frontend isse sunega
// // //   //   3. Specific events bhi emit hote hain — backward compatible
// // //   // ─────────────────────────────────────────────────────────────────────────
// // //   const notify = async ({ to, type, refId = null, refModel = null, meta = {} }) => {
// // //     if (!to || to.toString() === userId) return;

// // //     // ── Step 1: DB mein save ──────────────────────────────────────────────
// // //     let savedNotification = null;
// // //     try {
// // //       savedNotification = await Notification.createNotification({
// // //         receiver: to,
// // //         sender: userId,
// // //         type,
// // //         refId,
// // //         refModel,
// // //         meta,
// // //       });

// // //       if (!savedNotification) {
// // //         console.log(`⏭️ Notification deduped: ${type} → ${to}`);
// // //         return;
// // //       }
// // //     } catch (err) {
// // //       console.error(`❌ Notification DB save failed [${type}]:`, err.message);
// // //       // DB fail hone pe bhi emit try karo
// // //     }

// // //     // ── Step 2: Sender fetch — populate karo properly ─────────────────────
// // //     let senderObj = null;
// // //     try {
// // //       senderObj = await User.findById(userId)
// // //         .select("username fullName avatar isVerifiedBadge")
// // //         .lean();
// // //     } catch (err) {
// // //       console.error(`❌ Sender fetch failed:`, err.message);
// // //     }

// // //     // ── Step 3: notification:new emit — MAIN EVENT ────────────────────────
// // //     // Frontend NotificationPanel isse sunega
// // //     // sender populated object ke saath — "Someone" nahi aayega
// // //     try {
// // //       if (savedNotification) {
// // //         // Notification object mein sender inject karo (DB mein sirf ObjectId hai)
// // //         const notificationPayload = {
// // //           ...savedNotification.toObject(),
// // //           sender: senderObj,       // populated sender object
// // //           label: savedNotification.label, // virtual field
// // //         };

// // //         io.to(to.toString()).emit("notification:new", notificationPayload);
// // //         console.log(`🔔 notification:new emitted: ${type} → ${to}`);
// // //       }
// // //     } catch (err) {
// // //       console.error(`❌ notification:new emit failed:`, err.message);
// // //     }

// // //     // ── Step 4: Specific events — backward compatible ─────────────────────
// // //     // Purane toast listeners ke liye — hata mat, frontend use kar raha hai
// // //     try {
// // //       const eventMap = {
// // //         follow_request:          "follow_request_received",
// // //         follow_request_accepted: "follow_request_accepted",
// // //         follow:                  "follow_received",
// // //         post_like:               "post_liked",
// // //         post_comment:            "post_commented",
// // //         comment_reply:           "comment_replied",
// // //         comment_like:            "comment_liked",
// // //         story_reaction:          "story_reacted",
// // //         story_reply:             "story_replied",
// // //       };

// // //       const specificEvent = eventMap[type];
// // //       if (specificEvent) {
// // //         io.to(to.toString()).emit(specificEvent, {
// // //           sender: senderObj,
// // //           timestamp: new Date(),
// // //         });
// // //       }
// // //     } catch (err) {
// // //       console.error(`❌ Specific event emit failed:`, err.message);
// // //     }

// // //     // ── Step 5: Unread count update ───────────────────────────────────────
// // //     try {
// // //       const unreadCount = await Notification.getUnreadCount(to);
// // //       io.to(to.toString()).emit("notification:unread_count", { count: unreadCount });
// // //     } catch (err) {
// // //       console.error(`❌ Unread count emit failed:`, err.message);
// // //     }
// // //   };

// // //   // ── Socket Events ─────────────────────────────────────────────────────────

// // //   socket.on("send_follow_request", ({ to }) => {
// // //     notify({ to, type: "follow_request" });
// // //   });

// // //   socket.on("follow_accepted", ({ to }) => {
// // //     notify({ to, type: "follow_request_accepted" });
// // //   });

// // //   socket.on("send_follow", ({ to }) => {
// // //     notify({ to, type: "follow" });
// // //   });

// // //   socket.on("send_like", ({ to, postId }) => {
// // //     if (!postId) return;
// // //     notify({ to, type: "post_like", refId: postId, refModel: "Post" });
// // //   });

// // //   socket.on("send_comment", ({ to, postId, preview = null }) => {
// // //     if (!postId) return;
// // //     notify({
// // //       to,
// // //       type: "post_comment",
// // //       refId: postId,
// // //       refModel: "Post",
// // //       meta: { preview },
// // //     });
// // //   });

// // //   socket.on("send_reply", ({ to, postId, commentId, preview = null }) => {
// // //     notify({
// // //       to,
// // //       type: "comment_reply",
// // //       refId: commentId || postId,
// // //       refModel: "Comment",
// // //       meta: { preview },
// // //     });
// // //   });

// // //   socket.on("send_comment_like", ({ to, commentId }) => {
// // //     if (!commentId) return;
// // //     notify({ to, type: "comment_like", refId: commentId, refModel: "Comment" });
// // //   });

// // //   socket.on("send_story_reaction", ({ to, storyId, reaction }) => {
// // //     if (!storyId) return;
// // //     notify({
// // //       to,
// // //       type: "story_reaction",
// // //       refId: storyId,
// // //       refModel: "Story",
// // //       meta: { reaction },
// // //     });
// // //   });

// // //   // ── Mark as read ──────────────────────────────────────────────────────────
// // //   socket.on("notification:mark_read", async ({ notificationId }) => {
// // //     try {
// // //       if (notificationId === "all") {
// // //         await Notification.markAllAsRead(userId);
// // //       } else {
// // //         await Notification.markAsRead(notificationId, userId);
// // //       }
// // //       const count = await Notification.getUnreadCount(userId);
// // //       socket.emit("notification:unread_count", { count });
// // //     } catch (err) {
// // //       console.error("❌ Mark read failed:", err.message);
// // //     }
// // //   });

// // //   // ── Delete notification ───────────────────────────────────────────────────
// // //   socket.on("notification:delete", async ({ notificationId }) => {
// // //     try {
// // //       await Notification.softDelete(notificationId, userId);
// // //       const count = await Notification.getUnreadCount(userId);
// // //       socket.emit("notification:unread_count", { count });
// // //     } catch (err) {
// // //       console.error("❌ Notification delete failed:", err.message);
// // //     }
// // //   });
// // // };


// // // chat-server/socket/notificationHandler.js
// // import Notification from "../models/Notification.js";
// // import User from "../models/User.js";

// // export default (io, socket) => {
// //   const userId = (socket.user.id || socket.user._id)?.toString();

// //   socket.join(userId);
// //   console.log(`🔔 Notification room joined: ${userId}`);

// //   // ─────────────────────────────────────────────────────────────────────────
// //   // notify() — production-level helper
// //   //
// //   // Fix 1 — "Someone": sender User.findById se fresh populate hota hai
// //   //          DB object pe .toObject() nahi — fresh object banate hain
// //   // Fix 2 — Double badge: notification:unread_count EMIT NAHI KARTE ab
// //   //          Frontend slice khud count badhata hai addRealtimeNotification mein
// //   // Fix 3 — notification:new HAMESHA emit hota hai correct payload ke saath
// //   // ─────────────────────────────────────────────────────────────────────────
// //   const notify = async ({
// //     to,
// //     type,
// //     refId = null,
// //     refModel = null,
// //     meta = {},
// //   }) => {
// //     if (!to || to.toString() === userId) return;

// //     // ── Step 1: DB mein save ──────────────────────────────────────────────
// //     let savedNotification = null;
// //     try {
// //       savedNotification = await Notification.createNotification({
// //         receiver: to,
// //         sender:   userId,
// //         type,
// //         refId,
// //         refModel,
// //         meta,
// //       });

// //       if (!savedNotification) {
// //         console.log(`⏭️  Deduped: ${type} → ${to}`);
// //         return;
// //       }
// //     } catch (err) {
// //       console.error(`❌ DB save failed [${type}]:`, err.message);
// //       return; // DB fail hone pe emit bhi mat karo — inconsistent state avoid
// //     }

// //     // ── Step 2: Sender fetch — FIX 1 "Someone" ───────────────────────────
// //     // DB notification mein sender sirf ObjectId hai
// //     // Alag se User fetch karo populated object ke liye
// //     let senderObj = null;
// //     try {
// //       senderObj = await User.findById(userId)
// //         .select("_id username fullName avatar isVerifiedBadge")
// //         .lean(); // plain JS object — no mongoose overhead
// //     } catch (err) {
// //       console.error(`❌ Sender fetch failed:`, err.message);
// //       // senderObj null rahega — frontend fallback handle karega
// //     }
// //     console.log("🧑 senderObj:", JSON.stringify(senderObj));
// // console.log("🔍 userId for fetch:", userId);

// //     // ── Step 3: notification:new emit — FIX 1 + FIX 3 ───────────────────
// //     // Frontend NotificationPanel isse sunega
// //     // Manually payload build karo — .toObject() virtual fields nahi deta reliably
// //     const labelMap = {
// //       post_like:               "liked your post",
// //       post_comment:            "commented on your post",
// //       post_mention:            "mentioned you in a post",
// //       post_tag:                "tagged you in a post",
// //       comment_like:            "liked your comment",
// //       comment_reply:           "replied to your comment",
// //       comment_mention:         "mentioned you in a comment",
// //       follow:                  "started following you",
// //       follow_request:          "requested to follow you",
// //       follow_request_accepted: "accepted your follow request",
// //       story_view:              "viewed your story",
// //       story_reaction:          "reacted to your story",
// //       story_reply:             "replied to your story",
// //       story_mention:           "mentioned you in a story",
// //       new_message:             "sent you a message",
// //       new_group_message:       "sent a message in group",
// //       system:                  "system notification",
// //     };

// //     const notificationPayload = {
// //       _id:       savedNotification._id,
// //       type:      savedNotification.type,
// //       label:     labelMap[type] || type,   // virtual manually set
// //       sender:    senderObj,                // populated object — naam aayega
// //       receiver:  savedNotification.receiver,
// //       refId:     savedNotification.refId,
// //       refModel:  savedNotification.refModel,
// //       meta:      savedNotification.meta,
// //       isRead:    false,
// //       createdAt: savedNotification.createdAt,
// //     };

// //     try {
// //       io.to(to.toString()).emit("notification:new", notificationPayload);
// //       console.log(`🔔 notification:new → ${to} [${type}]`);
// //     } catch (err) {
// //       console.error(`❌ notification:new emit failed:`, err.message);
// //     }

// //     // ── Step 4: Specific events — backward compat (toast ke liye) ────────
// //     // FIX 2: notification:unread_count EMIT NAHI KARTE
// //     // Frontend slice addRealtimeNotification mein khud count badhata hai
// //     // Agar dono jagah badhao → double badge
// //     const eventMap = {
// //       follow_request:          "follow_request_received",
// //       follow_request_accepted: "follow_request_accepted",
// //       follow:                  "follow_received",
// //       post_like:               "post_liked",
// //       post_comment:            "post_commented",
// //       comment_reply:           "comment_replied",
// //       comment_like:            "comment_liked",
// //       story_reaction:          "story_reacted",
// //       story_reply:             "story_replied",
// //     };

// //     const specificEvent = eventMap[type];
// //     if (specificEvent) {
// //       try {
// //         io.to(to.toString()).emit(specificEvent, {
// //           sender:    senderObj,
// //           timestamp: new Date(),
// //         });
// //       } catch (err) {
// //         console.error(`❌ Specific event emit failed:`, err.message);
// //       }
// //     }
// //   };

// //   // ── Socket Event Listeners ────────────────────────────────────────────────

// //   socket.on("send_follow_request", ({ to }) => {
// //     if (to) notify({ to, type: "follow_request" });
// //   });

// //   socket.on("follow_accepted", ({ to }) => {
// //     if (to) notify({ to, type: "follow_request_accepted" });
// //   });

// //   socket.on("send_follow", ({ to }) => {
// //     if (to) notify({ to, type: "follow" });
// //   });

// //   socket.on("send_like", ({ to, postId }) => {
// //     if (to && postId) notify({ to, type: "post_like", refId: postId, refModel: "Post" });
// //   });

// //   socket.on("send_comment", ({ to, postId, preview = null }) => {
// //     if (to && postId) notify({
// //       to,
// //       type: "post_comment",
// //       refId: postId,
// //       refModel: "Post",
// //       meta: { preview: preview?.slice(0, 100) || null }, // max 100 chars
// //     });
// //   });

// //   socket.on("send_reply", ({ to, postId, commentId, preview = null }) => {
// //     if (to) notify({
// //       to,
// //       type: "comment_reply",
// //       refId: commentId || postId,
// //       refModel: "Comment",
// //       meta: { preview: preview?.slice(0, 100) || null },
// //     });
// //   });

// //   socket.on("send_comment_like", ({ to, commentId }) => {
// //     if (to && commentId) notify({ to, type: "comment_like", refId: commentId, refModel: "Comment" });
// //   });

// //   socket.on("send_story_reaction", ({ to, storyId, reaction }) => {
// //     if (to && storyId) notify({
// //       to,
// //       type: "story_reaction",
// //       refId: storyId,
// //       refModel: "Story",
// //       meta: { reaction },
// //     });
// //   });

// //   // ── Mark as read ──────────────────────────────────────────────────────────
// //   socket.on("notification:mark_read", async ({ notificationId }) => {
// //     try {
// //       if (notificationId === "all") {
// //         await Notification.markAllAsRead(userId);
// //       } else {
// //         await Notification.markAsRead(notificationId, userId);
// //       }
// //       const count = await Notification.getUnreadCount(userId);
// //       socket.emit("notification:unread_count", { count });
// //     } catch (err) {
// //       console.error("❌ Mark read failed:", err.message);
// //     }
// //   });

// //   // ── Delete ────────────────────────────────────────────────────────────────
// //   socket.on("notification:delete", async ({ notificationId }) => {
// //     try {
// //       await Notification.softDelete(notificationId, userId);
// //       const count = await Notification.getUnreadCount(userId);
// //       socket.emit("notification:unread_count", { count });
// //     } catch (err) {
// //       console.error("❌ Delete failed:", err.message);
// //     }
// //   });
// // };




// // chat-server/socket/notificationHandler.js
// import mongoose from "mongoose";
// import Notification from "../models/Notification.js";
// import User from "../models/User.js";

// export default (io, socket) => {
//   const userId = (socket.user?.id || socket.user?._id)?.toString();
//   if (!userId) return;

//   socket.join(userId);
//   console.log(`🔔 Notification room joined: ${userId}`);

//   const labelMap = {
//     post_like:               "liked your post",
//     post_comment:            "commented on your post",
//     post_mention:            "mentioned you in a post",
//     post_tag:                "tagged you in a post",
//     comment_like:            "liked your comment",
//     comment_reply:           "replied to your comment",
//     comment_mention:         "mentioned you in a comment",
//     follow:                  "started following you",
//     follow_request:          "sent you a follow request",
//     follow_request_accepted: "accepted your follow request",
//     story_view:              "viewed your story",
//     story_reaction:          "reacted to your story",
//     story_reply:             "replied to your story",
//     story_mention:           "mentioned you in a story",
//     new_message:             "sent you a message",
//     new_group_message:       "sent a message in the group",
//     system:                  "system notification",
//   };

//   // ─────────────────────────────────────────────────────────────────────────
//   // notify() — ek hi jagah se sab handle hota hai
//   // ─────────────────────────────────────────────────────────────────────────
//   const notify = async ({ to, type, refId = null, refModel = null, meta = {} }) => {
//     // Self-notification kabhi nahi
//     if (!to || to.toString() === userId) return;

//     // ── Step 1: DB save ───────────────────────────────────────────────────
//     let savedNotification;
//     try {
//       savedNotification = await Notification.createNotification({
//         receiver: to,
//         sender:   userId,
//         type,
//         refId,
//         refModel,
//         meta,
//       });

//       // createNotification null return karta hai duplicate pe
//       if (!savedNotification) {
//         console.log(`⏭️  Deduped [${type}] → ${to}`);
//         return;
//       }
//     } catch (err) {
//       console.error(`❌ DB save failed [${type}]:`, err.message);
//       return;
//     }

//     // ── Step 2: Sender fetch ──────────────────────────────────────────────
//     // ObjectId properly convert karo — string se findById kabhi kabhi fail hota hai
//     let senderObj = null;
//     try {
//       const oid = mongoose.Types.ObjectId.isValid(userId)
//         ? new mongoose.Types.ObjectId(userId)
//         : userId;

//       senderObj = await User.findById(oid)
//         .select("_id username fullName avatar isVerifiedBadge")
//         .lean();

//       if (!senderObj) {
//         console.warn(`⚠️  Sender not found in DB: ${userId}`);
//       } else {
//         console.log(`✅ Sender fetched: ${senderObj.fullName || senderObj.username}`);
//       }
//     } catch (err) {
//       console.error(`❌ Sender fetch error:`, err.message);
//     }

//     // ── Step 3: Ek hi payload — notification:new ─────────────────────────
//     // SIRF notification:new emit karo
//     // Frontend isse notification list + toast DONO ke liye use karta hai
//     // Alag specific events (post_commented, follow_received etc.) BILKUL NAHI
//     // — wahi duplicate ka reason tha
//     const payload = {
//       _id:       savedNotification._id,
//       type,
//       label:     labelMap[type] || type,
//       sender:    senderObj,
//       receiver:  to.toString(),
//       refId:     savedNotification.refId   ?? null,
//       refModel:  savedNotification.refModel ?? null,
//       meta:      savedNotification.meta    ?? {},
//       isRead:    false,
//       createdAt: savedNotification.createdAt,
//     };

//     io.to(to.toString()).emit("notification:new", payload);
//     console.log(`🔔 notification:new → ${to} [${type}]`);

//     // ── Step 4: notification:unread_count NAHI bhejte ────────────────────
//     // Frontend slice addRealtimeNotification mein khud +1 karta hai
//     // Agar yahan bhi bheja toh double badge aata hai
//   };

//   // ── Socket listeners ──────────────────────────────────────────────────────

//   socket.on("send_follow_request", ({ to }) => {
//     if (to) notify({ to, type: "follow_request" });
//   });

//   socket.on("follow_accepted", ({ to }) => {
//     if (to) notify({ to, type: "follow_request_accepted" });
//   });

//   socket.on("send_follow", ({ to }) => {
//     if (to) notify({ to, type: "follow" });
//   });

//   socket.on("send_like", ({ to, postId }) => {
//     if (to && postId) notify({ to, type: "post_like", refId: postId, refModel: "Post" });
//   });

//   socket.on("send_comment", ({ to, postId, preview = null }) => {
//     if (to && postId) notify({
//       to,
//       type:     "post_comment",
//       refId:    postId,
//       refModel: "Post",
//       meta:     { preview: preview?.slice(0, 100) ?? null },
//     });
//   });

//   socket.on("send_reply", ({ to, postId, commentId, preview = null }) => {
//     if (to) notify({
//       to,
//       type:     "comment_reply",
//       refId:    commentId || postId,
//       refModel: "Comment",
//       meta:     { preview: preview?.slice(0, 100) ?? null },
//     });
//   });

//   socket.on("send_comment_like", ({ to, commentId }) => {
//     if (to && commentId) notify({ to, type: "comment_like", refId: commentId, refModel: "Comment" });
//   });

//   socket.on("send_story_reaction", ({ to, storyId, reaction }) => {
//     if (to && storyId) notify({
//       to,
//       type:     "story_reaction",
//       refId:    storyId,
//       refModel: "Story",
//       meta:     { reaction },
//     });
//   });

//   // ── Mark as read ──────────────────────────────────────────────────────────
//   socket.on("notification:mark_read", async ({ notificationId }) => {
//     try {
//       if (notificationId === "all") {
//         await Notification.markAllAsRead(userId);
//       } else {
//         await Notification.markAsRead(notificationId, userId);
//       }
//       const count = await Notification.getUnreadCount(userId);
//       // Yahan count emit karna sahi hai — yeh user action ke baad authoritative count hai
//       socket.emit("notification:unread_count", { count });
//     } catch (err) {
//       console.error("❌ Mark read failed:", err.message);
//     }
//   });

//   // ── Delete ────────────────────────────────────────────────────────────────
//   socket.on("notification:delete", async ({ notificationId }) => {
//     try {
//       await Notification.softDelete(notificationId, userId);
//       const count = await Notification.getUnreadCount(userId);
//       socket.emit("notification:unread_count", { count });
//     } catch (err) {
//       console.error("❌ Delete failed:", err.message);
//     }
//   });
// };



// chat-server/socket/notificationHandler.js
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

export default (io, socket) => {
  const userId = (socket.user?.id || socket.user?._id)?.toString();
  if (!userId) return;

  socket.join(userId);
  console.log(`🔔 Notification room joined: ${userId}`);

  const labelMap = {
    post_like:               "liked your post",
    post_comment:            "commented on your post",
    post_mention:            "mentioned you in a post",
    post_tag:                "tagged you in a post",
    comment_like:            "liked your comment",
    comment_reply:           "replied to your comment",
    comment_mention:         "mentioned you in a comment",
    follow:                  "started following you",
    follow_request:          "sent you a follow request",
    follow_request_accepted: "accepted your follow request",
    story_view:              "viewed your story",
    story_reaction:          "reacted to your story",
    story_reply:             "replied to your story",
    story_mention:           "mentioned you in a story",
    new_message:             "sent you a message",
    new_group_message:       "sent a message in the group",
    system:                  "system notification",
  };

  const notify = async ({ to, type, refId = null, refModel = null, meta = {} }) => {
    if (!to || to.toString() === userId) return;

    // ── Step 1: DB save ───────────────────────────────────────────────────
    let savedNotification;
    try {
      savedNotification = await Notification.createNotification({
        receiver: to,
        sender:   userId,
        type,
        refId,
        refModel,
        meta,
      });
      if (!savedNotification) {
        console.log(`⏭️  Deduped [${type}] → ${to}`);
        return;
      }
    } catch (err) {
      console.error(`❌ DB save failed [${type}]:`, err.message);
      return;
    }

    // ── Step 2: Sender fetch ──────────────────────────────────────────────
    // chat-server ka User model "socialusers" collection use karta hai
    // mongoose.connection.db se directly query karo — model mismatch avoid
    let senderObj = null;
    try {
      // Pehle model se try karo
      const oid = new mongoose.Types.ObjectId(userId);
      senderObj = await User.findById(oid)
        .select("_id username fullName avatar isVerifiedBadge")
        .lean();

      // Agar model se nahi mila — directly collection se fetch karo
      if (!senderObj) {
        console.warn(`⚠️  User model miss — trying direct collection query`);
        const db = mongoose.connection.db;
        
        // Dono possible collection names try karo
        const collections = ["socialusers", "users"];
        for (const colName of collections) {
          const doc = await db.collection(colName).findOne(
            { _id: oid },
            { projection: { _id: 1, username: 1, fullName: 1, avatar: 1, isVerifiedBadge: 1 } }
          );
          if (doc) {
            senderObj = doc;
            console.log(`✅ Sender found in collection "${colName}": ${doc.fullName || doc.username}`);
            break;
          }
        }
      } else {
        console.log(`✅ Sender fetched via model: ${senderObj.fullName || senderObj.username}`);
      }

      if (!senderObj) {
        console.error(`❌ Sender not found anywhere. userId: ${userId}`);
        // Fallback — sirf ID se partial object banao
        // Frontend "Someone" dikhayega but crash nahi hoga
        senderObj = { _id: userId, fullName: null, username: null, avatar: null };
      }
    } catch (err) {
      console.error(`❌ Sender fetch error:`, err.message);
      senderObj = { _id: userId, fullName: null, username: null, avatar: null };
    }

    // ── Step 3: Emit notification:new ────────────────────────────────────
    const payload = {
      _id:       savedNotification._id,
      type,
      label:     labelMap[type] || type,
      sender:    senderObj,
      receiver:  to.toString(),
      refId:     savedNotification.refId   ?? null,
      refModel:  savedNotification.refModel ?? null,
      meta:      savedNotification.meta    ?? {},
      isRead:    false,
      createdAt: savedNotification.createdAt,
    };

    io.to(to.toString()).emit("notification:new", payload);
    console.log(`🔔 notification:new → ${to} [${type}] sender: ${senderObj.fullName || senderObj.username || "unknown"}`);

    // notification:unread_count EMIT NAHI — slice khud +1 karta hai
  };

  // ── Listeners ─────────────────────────────────────────────────────────────

  socket.on("send_follow_request", ({ to }) => {
    if (to) notify({ to, type: "follow_request" });
  });

  socket.on("follow_accepted", ({ to }) => {
    if (to) notify({ to, type: "follow_request_accepted" });
  });

  socket.on("send_follow", ({ to }) => {
    if (to) notify({ to, type: "follow" });
  });

  socket.on("send_like", ({ to, postId }) => {
    if (to && postId) notify({ to, type: "post_like", refId: postId, refModel: "Post" });
  });

  socket.on("send_comment", ({ to, postId, preview = null }) => {
    if (to && postId) notify({
      to, type: "post_comment", refId: postId, refModel: "Post",
      meta: { preview: preview?.slice(0, 100) ?? null },
    });
  });

  socket.on("send_reply", ({ to, postId, commentId, preview = null }) => {
    if (to) notify({
      to, type: "comment_reply",
      refId: commentId || postId, refModel: "Comment",
      meta: { preview: preview?.slice(0, 100) ?? null },
    });
  });

  socket.on("send_comment_like", ({ to, commentId }) => {
    if (to && commentId) notify({ to, type: "comment_like", refId: commentId, refModel: "Comment" });
  });

  socket.on("send_story_reaction", ({ to, storyId, reaction }) => {
    if (to && storyId) notify({
      to, type: "story_reaction", refId: storyId, refModel: "Story",
      meta: { reaction },
    });
  });

  // ── Mark as read ──────────────────────────────────────────────────────────
  socket.on("notification:mark_read", async ({ notificationId }) => {
    try {
      if (notificationId === "all") {
        await Notification.markAllAsRead(userId);
      } else {
        await Notification.markAsRead(notificationId, userId);
      }
      const count = await Notification.getUnreadCount(userId);
      socket.emit("notification:unread_count", { count });
    } catch (err) {
      console.error("❌ Mark read failed:", err.message);
    }
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  socket.on("notification:delete", async ({ notificationId }) => {
    try {
      await Notification.softDelete(notificationId, userId);
      const count = await Notification.getUnreadCount(userId);
      socket.emit("notification:unread_count", { count });
    } catch (err) {
      console.error("❌ Delete failed:", err.message);
    }
  });
};