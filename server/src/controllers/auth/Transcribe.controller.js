import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import FormData from "form-data";
import fetch from "node-fetch";

const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

export const transcribeAudio = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Audio file is required.", 400));
  }

  if (!process.env.GROQ_API_KEY) {
    return next(new AppError("AI service not configured.", 500));
  }

  // File size check — Groq max 25MB hai
  if (req.file.size > 25 * 1024 * 1024) {
    return next(new AppError("Audio file too large. Max 25MB allowed.", 400));
  }

  const form = new FormData();
  form.append("file", req.file.buffer, {
    filename: req.file.originalname || "audio.webm",
    contentType: req.file.mimetype || "audio/webm",
  });
  form.append("model", "whisper-large-v3-turbo"); // fast + accurate + free tier
  form.append("response_format", "text");
  form.append("temperature", "0");
  // language set nahi kar rahe — Whisper auto-detect karega (Hindi/English dono)

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
      return next(new AppError("Voice service busy. Try again in a moment.", 429));
    }
    if (groqRes.status === 413) {
      return next(new AppError("Audio too long. Please keep it under 2 minutes.", 413));
    }
    
    return next(new AppError(err?.error?.message || "Transcription failed.", 502));
  }
  const transcript = await groqRes.text();

  if (!transcript?.trim()) {
    return next(new AppError("Could not transcribe audio.", 422));
  }

  res.status(200).json({
    success: true,
    data: { transcript: transcript.trim() },
  });
});