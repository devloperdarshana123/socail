

import "dotenv/config";

import app from "./app.js";
import prisma from "./config/prisma.js";
import { connectRedis } from "./config/redis.js";
import { startAutoActivateJob } from "./jobs/autoActivateSuspendedUsers.js";
import logger from "./config/logger.js";

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception! Shutting down...", {
    message: err.message,
    stack  : err.stack,
  });
  process.exit(1);
});

// ── DB + Redis connect ──
async function startServer() {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL connected via Prisma");

    await connectRedis();

    startAutoActivateJob();

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on http://localhost:${PORT}`);
    });

    process.on("unhandledRejection", (err) => {
      logger.error("Unhandled Promise Rejection! Shutting down...", {
        message: err.message,
        stack  : err.stack,
      });
      server.close(() => process.exit(1));
    });

    // ── Graceful shutdown ──
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info("Prisma disconnected");
        process.exit(0);
      });
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT",  () => shutdown("SIGINT"));

  } catch (err) {
    logger.error("Failed to start server", {
      message: err.message,
      stack  : err.stack,
    });
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();