import { Router } from "express";
import { chatWithAI } from "../../controllers/auth/chat.controller.js";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";

const router = Router();

// POST /api/v2/chat/ai
router.post("/ai", isAuthenticated, isActive, chatWithAI);

export default router;