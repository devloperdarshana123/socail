// src/routes/healthRoutes.js
import { Router } from "express";
import prisma from "../config/prisma.js";

const router = Router();

router.get("/health", async (_req, res) => {
  let dbStatus = "disconnected";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  res.json({
    status: "ok",
    db: dbStatus,
  });
});

export default router;