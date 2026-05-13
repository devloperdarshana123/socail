import mongoose from "mongoose";
import logger from "./logger.js";

const connectDatabase = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      logger.error("MONGODB_URI is missing in environment variables");
      process.exit(1);
    }

    const { connection } = await mongoose.connect(mongoURI);

    // Success log
    logger.info("MongoDB connected successfully", {
      host: connection.host,
      database: connection.name,
      port: connection.port,
    });
  } catch (error) {
    logger.error("MongoDB connection failed", {
      error: error.message,
      stack: error.stack,
    });

    process.exit(1);
  }
};

// ----------------------------
// MongoDB Event Listeners
// ----------------------------

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected");
});

mongoose.connection.on("error", (err) => {
  logger.error("MongoDB connection error", {
    error: err.message,
  });
});

export default connectDatabase;