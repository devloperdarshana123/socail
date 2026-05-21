import express from "express";
import multer from "multer";
import { transcribeAudio } from "../../controllers/auth/Transcribe.controller.js";
import { isAuthenticated } from "../../middlewares/auth.js"; // tumhara existing auth middleware

const router = express.Router();

// Memory storage — file disk pe save nahi hogi, seedha buffer mein
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      "audio/webm",
      "audio/wav",
      "audio/mp4",
      "audio/mpeg",
      "audio/ogg",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid audio format."), false);
    }
  },
});

// POST /api/transcribe
router.post("/", isAuthenticated, upload.single("audio"), transcribeAudio);

export default router;