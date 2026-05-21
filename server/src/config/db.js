// import mongoose from "mongoose";
// import logger from "./logger.js";

// const connectDatabase = async () => {
//   try {
//     const mongoURI = process.env.MONGO_URI;

//     if (!mongoURI) {
//       logger.error("MONGODB_URI is missing in environment variables");
//       process.exit(1);
//     }

//     const { connection } = await mongoose.connect(mongoURI);

//     // Success log
//     logger.info("MongoDB connected successfully", {
//       host: connection.host,
//       database: connection.name,
//       port: connection.port,
//     });
//   } catch (error) {
//     logger.error("MongoDB connection failed", {
//       error: error.message,
//       stack: error.stack,
//     });

//     process.exit(1);
//   }
// };

// // ----------------------------
// // MongoDB Event Listeners
// // ----------------------------

// mongoose.connection.on("disconnected", () => {
//   logger.warn("MongoDB disconnected");
// });

// mongoose.connection.on("reconnected", () => {
//   logger.info("MongoDB reconnected");
// });

// mongoose.connection.on("error", (err) => {
//   logger.error("MongoDB connection error", {
//     error: err.message,
//   });
// });

// export default connectDatabase;

import mongoose from "mongoose";
import logger from "./logger.js";

const connectDatabase = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      logger.error("MONGO_URI is missing in environment variables");
      process.exit(1);
    }

    await mongoose.connect(mongoURI, {
      // CHANGE 1: Connection pool — production mein multiple requests handle hoti hain
      maxPoolSize: 10,
      minPoolSize: 2,
      // CHANGE 2: Timeouts — hang nahi karega
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info("MongoDB connected", {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });
  } catch (error) {
    logger.error("MongoDB connection failed", { error: error.message });
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
mongoose.connection.on("error", (err) => logger.error("MongoDB error", { error: err.message }));

// CHANGE 3: Graceful shutdown — ye bilkul missing tha
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed — app terminating");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed — SIGTERM received");
  process.exit(0);
});

export default connectDatabase;