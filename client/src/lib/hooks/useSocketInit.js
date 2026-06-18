
// client/src/lib/hooks/useSocketInit.js
import { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { connectSocket, disconnectSocket } from "../services/socketManager";
import { fetchConversations } from "../redux/chatSlice";

export default function useSocketInit() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const userId   = user?._id?.toString();

  const convsPreloadedRef = useRef(false);

  // ── Conversations preload ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || convsPreloadedRef.current) return;
    convsPreloadedRef.current = true;
    dispatch(fetchConversations());
  }, [userId, dispatch]);

  // ── Socket connect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    connectSocket(userId);

    const handleLogout = () => disconnectSocket();
    window.addEventListener("auth:logout", handleLogout);

    return () => {
      window.removeEventListener("auth:logout", handleLogout);
    };
  }, [userId, dispatch]);
}