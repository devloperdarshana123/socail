// src/routes/healthRoutes.js
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/health", (_req, res) => res.json({
  status: "ok",
  db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
}));

export default router;