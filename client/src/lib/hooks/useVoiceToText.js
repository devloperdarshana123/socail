import { useState, useRef, useCallback } from "react";
import api from "../services/api";

/**
 * useVoiceToText
 * Mic se audio record karo → Groq Whisper → text milega
 *
 * Usage:
 *   const { isRecording, isTranscribing, error, start, stop } = useVoiceToText({
 *     onResult: (text) => setInputValue(text),
 *   });
 */
export function useVoiceToText({ onResult } = {}) {
  const [isRecording,    setIsRecording]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error,          setError]          = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);

  const start = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(audioChunksRef.current, { type: mimeType });

        if (blob.size < 1000) {
          setError("No audio detected. Please try again.");
          return;
        }

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append(
            "audio",
            blob,
            mimeType.includes("ogg") ? "audio.ogg" : "audio.webm"
          );

          const { data } = await api.post("/transcribe", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          const transcript = data?.data?.transcript?.trim();
          if (transcript) {
            onResult?.(transcript);
          } else {
            setError("Could not understand. Please try again.");
          }
        } catch (err) {
          setError(err?.response?.data?.message || "Transcription failed.");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied.");
      } else {
        setError("Could not start microphone.");
      }
    }
  }, [onResult]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isRecording,
    isTranscribing,
    error,
    start,
    stop,
    toggle,
    clearError,
  };
}