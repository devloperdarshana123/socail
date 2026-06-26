import FormData from "form-data";
import fetch from "node-fetch";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

// ── Transcribe audio using Groq Whisper ────────────────────────────────
export const transcribeAudio = async (fileBuffer, fileName, fileMimeType) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("AI service not configured");
  }

  // File size check — Groq max 25MB
  if (fileBuffer.length > 25 * 1024 * 1024) {
    throw new Error("Audio file too large. Max 25MB allowed.");
  }

  const form = new FormData();
  form.append("file", fileBuffer, {
    filename: fileName || "audio.webm",
    contentType: fileMimeType || "audio/webm",
  });
  form.append("model", "whisper-large-v3-turbo"); // fast + accurate
  form.append("response_format", "text");
  form.append("temperature", "0");

  const groqRes = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!groqRes.ok) {
    const err = await groqRes.json().catch(() => ({}));

    if (groqRes.status === 429) {
      throw new Error("RATE_LIMIT: Voice service busy. Try again in a moment.");
    }
    if (groqRes.status === 413) {
      throw new Error("PAYLOAD_TOO_LARGE: Audio too long. Please keep it under 2 minutes.");
    }

    throw new Error(err?.error?.message || "Transcription failed.");
  }

  const transcript = await groqRes.text();

  if (!transcript?.trim()) {
    throw new Error("Could not transcribe audio. Try again.");
  }

  return transcript.trim();
};