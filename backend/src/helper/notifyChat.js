import axios from "axios";

const CHAT_SERVER = process.env.CHAT_SERVER_URL || "http://localhost:5001";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export const notifyChat = async (endpoint, data) => {
  try {
    await axios.post(`${CHAT_SERVER}${endpoint}`, data, {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
  } catch (err) {
    console.error(`❌ Chat notify error [${endpoint}]:`, err.message);
  }
};