
import { config } from "dotenv";
config(); // ✅ SABSE PEHLE

import http from "http";
import mongoose from "mongoose";
import app from "./app.js";
import { initSocket } from "./src/socket/index.js";
import { connectRedis, disconnectRedis } from "./src/config/redis.js";
import logger from "./src/utils/logger.js";

const server = http.createServer(app);

mongoose.connection.on("disconnected", () =>
  logger.error("❌ MongoDB disconnected")
);
mongoose.connection.on("error", (err) =>
  logger.error("❌ MongoDB error", { err })
);

const startServer = async () => {
  try {
    // 1. MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("✅ MongoDB connected");

    // 2. Redis — env loaded hone ke baad
    const { pubClient, subClient } = await connectRedis();

    // 3. Socket — Redis clients ke saath
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

// const shutdown = async (signal) => {
//   logger.warn(`⚠️ ${signal} received — shutting down gracefully`);

//   server.close(async () => {
//     await mongoose.connection.close();
//     logger.info("✅ MongoDB closed");

//     await disconnectRedis();
//     logger.info("✅ Redis closed");

//     logger.info("✅ Server closed");
//     process.exit(0);
//   });
// };


const shutdown = async (signal) => {
  logger.warn(`⚠️ ${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error("❌ Forced exit after timeout");
    process.exit(1);
  }, 30_000);

  server.close(async () => {
    clearTimeout(forceExit);
    await mongoose.connection.close();
    logger.info("✅ MongoDB closed");

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