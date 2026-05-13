// import axios from "axios";

// export const sendNotification = async ({ to, from, fromName, fromAvatar, postId, type, text }) => {
//   try {
//     if (to === from) return;
//     await axios.post(
//       `${process.env.CHAT_SERVER_URL}/notify/comment`,
//       { to, from, fromName, fromAvatar, postId, type, text },
//       { headers: { "x-internal-secret": process.env.INTERNAL_SECRET } }
//     );
//   } catch (err) {
//     console.error("Notification failed:", err.message);
//   }
// };


import Notification from "../models/Notification.model.js";

export const sendNotification = async ({
  to,
  from,
  type,
  post,
  story,
  text = "",
}) => {
  try {
    if (!to || !from) return;
    if (to.toString() === from.toString()) return; // self-notify nahi

    await Notification.create({ recipient: to, sender: from, type, post, story, text });
  } catch (err) {
    console.error("Notification failed:", err.message);
  }
};