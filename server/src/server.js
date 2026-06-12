

import "dotenv/config";

import app from "./app.js";
import connectDatabase from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import logger from "./config/logger.js";

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception! Shutting down...", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

connectDatabase();
connectRedis();
const PORT = process.env.PORT || 5000;
const server = app.listen(process.env.PORT, () => {
  logger.info(`Server is running on http://localhost:${process.env.PORT}`);
});

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection! Shutting down...", {
    message: err.message,
    stack: err.stack,
  });
  server.close(() => process.exit(1));
});