

import "dotenv/config";

import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
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
    // Provider-aware: opens Postgres or Mongo depending on
    // DATABASE_PROVIDER, and on the prisma path opens Mongo alongside it as
    // additive infrastructure. See config/database.js.
    const backend = await connectDatabase();
    logger.info(`${backend} connected`);

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
        const closed = await disconnectDatabase();
        logger.info(`${closed} disconnected`);
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
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
}

startServer();