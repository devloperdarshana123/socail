import logger from "../config/logger.js";

const CHAT_SERVER_URL      = process.env.CHAT_SERVER_URL;
const CHAT_INTERNAL_SECRET = process.env.CHAT_INTERNAL_SECRET;

export const notifyAdmin = async ({ type, meta = {} }) => {
  if (!CHAT_SERVER_URL || !CHAT_INTERNAL_SECRET) {
    logger.warn("notifyAdmin: CHAT_SERVER_URL or CHAT_INTERNAL_SECRET not set");
    return;
  }

  try {
    const res = await fetch(`${CHAT_SERVER_URL}/notify/admin-notify`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-internal-secret": CHAT_INTERNAL_SECRET,
      },
      body: JSON.stringify({ type, meta }),
    });

    if (!res.ok) {
  const body = await res.text();
  logger.error("notifyAdmin: chat-server error", { status: res.status, body });
}
 } catch (err) {
  logger.error("notifyAdmin: failed", { error: err.message, stack: err.stack });
}
};