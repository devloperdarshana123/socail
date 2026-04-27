

import { createContext, useContext, useEffect } from "react";
import { useSelector } from "react-redux";
import { socialSocket, chatSocket } from "../services/socket";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const user = useSelector((state) => state.auth?.user);

  useEffect(() => {
    if (!user?._id) return;

    // Social socket — userId pass karo
    socialSocket.auth = { userId: user._id };
    socialSocket.connect();

    // Chat socket — token already set hai auth callback mein
    chatSocket.connect();

    const onSocialConnect = () => console.log("✅ Social socket connected!");
    const onChatConnect   = () => console.log("✅ Chat socket connected!");
    const onSocialError   = (err) => console.log("❌ Social socket error:", err.message);
    const onChatError     = (err) => console.log("❌ Chat socket error:", err.message);

    socialSocket.on("connect", onSocialConnect);
    socialSocket.on("connect_error", onSocialError);
    chatSocket.on("connect", onChatConnect);
    chatSocket.on("connect_error", onChatError);

    return () => {
      socialSocket.off("connect", onSocialConnect);
      socialSocket.off("connect_error", onSocialError);
      chatSocket.off("connect", onChatConnect);
      chatSocket.off("connect_error", onChatError);
    };
  }, [user?._id]);

  return (
    <SocketContext.Provider value={{ socialSocket, chatSocket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);