// // src/services/userService.js
// import mongoose from "mongoose";
// import User from "../../models/User.js";

// export const fetchSender = async (senderId) => {
//   try {
//     const oid = new mongoose.Types.ObjectId(senderId.toString());

//     return sender || { _id: senderId, fullName: null, username: null, avatar: null };
//   } catch {
//     return { _id: senderId, fullName: null, username: null, avatar: null };
//   }
// };

// export const isBlocked = async (userIdA, userIdB) => {
//   const [a, b] = await Promise.all([
//     User.findById(userIdA).select("blockedUsers").lean(),
//     User.findById(userIdB).select("blockedUsers").lean(),
//   ]);
//   return (
//     a?.blockedUsers?.map(String).includes(String(userIdB)) ||
//     b?.blockedUsers?.map(String).includes(String(userIdA))
//   );
// };



// ✅ Model ko call karo — logic duplicate mat karo
import User from "../../models/User.js";

export const fetchSender = (senderId) =>
  User.findForChat(senderId).catch(() => ({
    _id: senderId, fullName: null, username: null, avatar: null,
  }));

export const isBlocked = (userIdA, userIdB) =>
  User.isBlocked(userIdA, userIdB).catch(() => false);