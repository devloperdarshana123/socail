

// client/src/lib/hooks/useChat.js
import { useCallback, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { getSocket } from "../services/socketManager";
import { addOptimisticMessage } from "../redux/chatSlice";
// ── Cloudinary upload ────── line ke upar yeh add karo
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:9080";
// ── Cloudinary upload ────────────────────────────────────────────────────────
const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadToCloudinary = async (file, resourceType = "image") => {
  if (!CLOUD_NAME || !UPLOAD_PRESET)
    throw new Error("Cloudinary env vars missing");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", resourceType === "audio" ? "chat_audio" : "chat_images");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Upload failed");
  }
  const data = await res.json();
  return {
    url:      data.secure_url,
    publicId: data.public_id,
    duration: data.duration || null, // audio ke liye
    width:    data.width   || null,
    height:   data.height  || null,
  };
};

export const uploadImageToCloudinary = (file) => uploadToCloudinary(file, "image");

// ── Main hook ────────────────────────────────────────────────────────────────
export default function useChat() {
  const dispatch  = useDispatch();
  const { user }  = useSelector((s) => s.auth);
  const userId    = user?._id?.toString();
  const typingTimers = useRef({});

  // Voice recording state
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const [isRecording,  setIsRecording]  = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef(null);

  // ── Join / Leave ─────────────────────────────────────────────────────────
  const joinConversation = useCallback((conversationId) => {
    if (!conversationId) return;
    const s = getSocket();
    if (!s) return;
    if (s.connected) {
      s.emit("conversation:join", { conversationId });
    } else {
      const onConnect = () => {
        s.emit("conversation:join", { conversationId });
        s.off("connect", onConnect);
      };
      s.on("connect", onConnect);
    }
  }, []);

  const leaveConversation = useCallback((conversationId) => {
    if (!conversationId) return;
    getSocket()?.emit("conversation:leave", { conversationId });
  }, []);

  // ── Send text message ────────────────────────────────────────────────────
  const sendMessage = useCallback(({ conversationId, text, image, replyTo }) => {
    const s = getSocket();
    if (!s?.connected || !userId || !conversationId) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    dispatch(addOptimisticMessage({
      conversationId,
      message: {
        _id: tempId, conversationId,
       sender: { _id: String(userId) },
        text: text || "", image: image || null,
        replyTo: replyTo || null,
        createdAt: new Date().toISOString(),
        seenBy: [String(userId)], reactions: [], isOptimistic: true,
      },
    }));

    s.emit("message:send", {
      conversationId,
      message: { text: text?.trim() || "", image: image || null, replyTo: replyTo || null, tempId },
    });
  }, [userId, dispatch]);

  // ── Send image message ───────────────────────────────────────────────────
  const sendImageMessage = useCallback(async ({ conversationId, file, text, replyTo, onProgress }) => {
    const s = getSocket();
    if (!s?.connected || !userId || !conversationId) return { success: false, error: "Not connected" };

    try {
      onProgress?.("uploading");
      const imageData = await uploadImageToCloudinary(file);
      onProgress?.("sending");

      const tempId = `temp_img_${Date.now()}`;
      dispatch(addOptimisticMessage({
        conversationId,
        message: {
          _id: tempId, conversationId,
         sender: { _id: String(userId) },
          text: text?.trim() || "",
          image: { url: URL.createObjectURL(file) },
          replyTo: replyTo || null,
          createdAt: new Date().toISOString(),
         seenBy: [String(userId)], reactions: [], isOptimistic: true,
        },
      }));

      s.emit("message:send", {
        conversationId,
        message: { text: text?.trim() || "", image: imageData, replyTo: replyTo || null, tempId },
      });

      onProgress?.(null);
      return { success: true };
    } catch (err) {
      onProgress?.(null);
      return { success: false, error: err.message };
    }
  }, [userId, dispatch]);

  // ── Voice recording ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Best supported format
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100); // collect every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
recordingTimerRef.current = setInterval(() => {
  setRecordingTime((t) => {
    if (t >= 120) {
      mediaRecorderRef.current?.stop();
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
      return t;
    }
    return t + 1;
  });
}, 1000);

      return { success: true };
   } catch {
  return { success: false, error: "Microphone access denied" };
}
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        // Stop all tracks
        recorder.stream?.getTracks().forEach((t) => t.stop());
        audioChunksRef.current = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stream?.getTracks().forEach((t) => t.stop());
      recorder.stop();
    }
    audioChunksRef.current = [];
  }, []);

  // ── Send voice message ───────────────────────────────────────────────────
  const sendVoiceMessage = useCallback(async ({ conversationId, audioBlob, replyTo, onProgress }) => {
    const s = getSocket();
    if (!s?.connected || !userId || !conversationId || !audioBlob) 
      return { success: false, error: "Not connected" };

    try {
      onProgress?.("uploading");

      // Convert blob to file for upload
      const ext  = audioBlob.type.includes("ogg") ? "ogg" : "webm";
      const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: audioBlob.type });

      const audioData = await uploadToCloudinary(file, "video"); // Cloudinary audio = video resource type
      onProgress?.("sending");

      const tempId  = `temp_audio_${Date.now()}`;
      const blobUrl = URL.createObjectURL(audioBlob);

      dispatch(addOptimisticMessage({
        conversationId,
        message: {
          _id: tempId, conversationId,
          sender: { _id: String(userId) },
          text: "", image: null,
          audio: { url: blobUrl, duration: audioData.duration || 0 }, // local preview
          replyTo: replyTo || null,
          createdAt: new Date().toISOString(),
          seenBy: [String(userId)], reactions: [], isOptimistic: true,
          type: "audio",
        },
      }));

      s.emit("message:send", {
        conversationId,
        message: {
          text: "", image: null,
          audio: { url: audioData.url, publicId: audioData.publicId, duration: audioData.duration || 0 },
          replyTo: replyTo || null,
          tempId,
        },
      });

      onProgress?.(null);
      return { success: true };
    } catch (err) {
      onProgress?.(null);
      return { success: false, error: err.message };
    }
  }, [userId, dispatch]);

  // ── Mark seen ────────────────────────────────────────────────────────────
  const markSeen = useCallback(({ conversationId, messageId }) => {
    const s = getSocket();
    if (!s?.connected) return;
    s.emit("message:seen", { conversationId, messageId });
  }, []);

  // ── Edit message ─────────────────────────────────────────────────────────
  const editMessage = useCallback(({ conversationId, messageId, newText }) => {
    const s = getSocket();
    if (!s?.connected || !newText?.trim()) return;
    s.emit("message:edit", { conversationId, messageId, newText });
  }, []);

  // ── Delete message ───────────────────────────────────────────────────────
  const deleteMessage = useCallback(({ conversationId, messageId }) => {
    const s = getSocket();
    if (!s?.connected) return;
    s.emit("message:delete", { conversationId, messageId });
  }, []);

  // ── React ────────────────────────────────────────────────────────────────
  const reactToMessage = useCallback(({ conversationId, messageId, emoji }) => {
    const s = getSocket();
    if (!s?.connected) return;
    s.emit("message:react", { conversationId, messageId, emoji });
  }, []);

  // ── Typing ───────────────────────────────────────────────────────────────
  const startTyping = useCallback((conversationId) => {
    const s = getSocket();
    if (!s?.connected || !conversationId) return;
    s.emit("typing:start", { conversationId });
    if (typingTimers.current[conversationId]) clearTimeout(typingTimers.current[conversationId]);
    typingTimers.current[conversationId] = setTimeout(() => {
      getSocket()?.emit("typing:stop", { conversationId });
      delete typingTimers.current[conversationId];
    }, 3000);
  }, []);

  const stopTyping = useCallback((conversationId) => {
    const s = getSocket();
    if (!s?.connected || !conversationId) return;
    if (typingTimers.current[conversationId]) {
      clearTimeout(typingTimers.current[conversationId]);
      delete typingTimers.current[conversationId];
    }
    s.emit("typing:stop", { conversationId });
  }, []);

  // ── Block / Unblock / Report ─────────────────────────────────────────────
const blockUser = useCallback(async ({ targetUserId }) => {
    if (!targetUserId) return { success: false };
    try {
      const res = await fetch(`${BASE_URL}/api/v2/user/block/${targetUserId}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      // Online user ko real-time notify karo
      getSocket()?.emit("user:blocked:notify", { targetUserId });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const unblockUser = useCallback(async ({ targetUserId }) => {
    if (!targetUserId) return { success: false };
    try {
      const res = await fetch(`${BASE_URL}/api/v2/user/block/${targetUserId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      getSocket()?.emit("user:unblocked:notify", { targetUserId });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  
  const reportUser = useCallback(({ targetUserId, reason }) => {
    const s = getSocket();
    if (!s?.connected || !targetUserId) return;
    s.emit("user:report", { targetUserId, reason });
  }, []);

  const checkBlockStatus = useCallback(({ targetUserId }) => {
    const s = getSocket();
    if (!s?.connected || !targetUserId) return;
    s.emit("user:blockStatus", { targetUserId });
  }, []);

  return {
    // messaging
    sendMessage, sendImageMessage, sendVoiceMessage,
    editMessage, deleteMessage, reactToMessage,
    markSeen, joinConversation, leaveConversation,
    startTyping, stopTyping,
    // voice
    startRecording, stopRecording, cancelRecording,
    isRecording, recordingTime,
    // block/report
    blockUser, unblockUser, reportUser, checkBlockStatus,
  };
}