

import { config } from "dotenv";
config();

import http from "http";
import app from "./app.js";
import { initSocket } from "./src/socket/index.js";
import { connectRedis, disconnectRedis } from "./src/config/redis.js";
import logger from "./src/utils/logger.js";
import prisma from "./src/config/prisma.js";

const server = http.createServer(app);

const startServer = async () => {
  try {
    // 1. Prisma — DB connection test
    await prisma.$connect();
    logger.info("✅ PostgreSQL connected via Prisma");

    // 2. Redis
    const { pubClient, subClient } = await connectRedis();

    // 3. Socket
    initSocket(server, pubClient, subClient);

    // 4. Server start
    server.listen(process.env.PORT || 5001, () => {
      logger.info(`🚀 Chat server on port ${process.env.PORT || 5001}`);
    });

  } catch (err) {
    logger.error("❌ Startup failed", { err });
    process.exit(1);
  }
};

startServer();

const shutdown = async (signal) => {
  logger.warn(`⚠️ ${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error("❌ Forced exit after timeout");
    process.exit(1);
  }, 30_000);

  server.close(async () => {
    clearTimeout(forceExit);
    await prisma.$disconnect();
    logger.info("✅ PostgreSQL disconnected");

    await disconnectRedis();
    logger.info("✅ Redis closed");

    logger.info("✅ Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("❌ Unhandled Rejection", { reason });
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.error("❌ Uncaught Exception", { err });
  process.exit(1);
});