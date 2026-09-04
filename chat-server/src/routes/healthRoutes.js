// src/routes/healthRoutes.js
import { Router } from "express";
import { pingDatabase } from "../config/database.js";

const router = Router();

router.get("/health", async (_req, res) => {
  // Provider-aware probe — same "connected"/"disconnected" values as before.
  const dbStatus = await pingDatabase();

  res.json({
    status: "ok",
    db: dbStatus,
  });
});

export default router;