import express from "express";
import { saveConsent, getConsent } from "../../controllers/auth/consent.controller.js";

const router = express.Router();

// POST /api/consent
router.post("/", saveConsent);

// GET /api/consent/:sessionId
router.get("/:sessionId", getConsent);

export default router;