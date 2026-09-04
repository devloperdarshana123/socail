import asyncHandler from 'express-async-handler';
import AppError from '../../utils/AppError.js';
import { transcribeAudio as transcribeAudioHelper } from '../../utils/transcribeHelpers.js';
import logger from '../../config/logger.js';           // adjust path if needed
export const transcribeAudio = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Audio file is required.", 400));
  }

  // Validate file type (optional but recommended)
  const validAudioMimes = [
    "audio/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/mp4",
    "audio/m4a",
    "audio/ogg",
    "audio/flac",
  ];

  if (!validAudioMimes.includes(req.file.mimetype)) {
    return next(
      new AppError(
        `Invalid audio format. Supported: ${validAudioMimes.join(", ")}`,
        400
      )
    );
  }

  try {
   const transcript = await transcribeAudioHelper(
  req.file.buffer,
  req.file.originalname || "audio.webm",
  req.file.mimetype || "audio/webm"
);

    logger.info("Audio transcribed", {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      transcriptLength: transcript.length,
    });

    return res.status(200).json({
      success: true,
      data: { transcript },
    });
  } catch (err) {
    // Handle specific errors
    if (err.message.includes("RATE_LIMIT")) {
      return next(new AppError(err.message.replace("RATE_LIMIT: ", ""), 429));
    }
    if (err.message.includes("PAYLOAD_TOO_LARGE")) {
      return next(new AppError(err.message.replace("PAYLOAD_TOO_LARGE: ", ""), 413));
    }
    if (err.message.includes("not configured")) {
      return next(new AppError("AI service not configured.", 500));
    }
    if (err.message.includes("25MB")) {
      return next(new AppError(err.message, 400));
    }

    // Generic error
    logger.error("Transcription failed", { error: err.message });
    return next(new AppError("Transcription failed. Please try again.", 502));
  }
});