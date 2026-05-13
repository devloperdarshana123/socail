// // import dotenv from "dotenv";

// // import app from "./app.js";
// // import path from "path";
// // import connectDatabase from "./config/db.js";
// // import logger from "./config/logger.js";

// // if (process.env.NODE_ENV !== "production") {
// //   dotenv.config({ path: path.resolve(process.cwd(), ".env") });
// // }

// // // -----------------------------
// // // Uncaught Exception Handler
// // // -----------------------------
// // process.on("uncaughtException", (err) => {
// //   logger.error("Uncaught Exception! Shutting down...", {
// //     message: err.message,
// //     stack: err.stack,
// //   });
// //   process.exit(1);
// // });

// // // -----------------------------
// // // Database Connection
// // // -----------------------------
// // connectDatabase();

// // // -----------------------------
// // // Server Start
// // // -----------------------------
// // const server = app.listen(process.env.PORT, () => {
// //   logger.info(`Server is running on http://localhost:${process.env.PORT}`, {
// //     port: process.env.PORT,
// //     environment: process.env.NODE_ENV,
// //   });
// // });

// // // -----------------------------
// // // Unhandled Rejection Handler
// // // -----------------------------
// // process.on("unhandledRejection", (err) => {
// //   logger.error("Unhandled Promise Rejection! Shutting down...", {
// //     message: err.message,
// //     stack: err.stack,
// //   });

// //   server.close(() => {
// //     process.exit(1);
// //   });
// // });


// import dotenv from "dotenv";
// dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

// import app from "./app.js";
// import path from "path";
// import connectDatabase from "./config/db.js";
// import logger from "./config/logger.js";

// // -----------------------------
// // Uncaught Exception Handler
// // -----------------------------
// process.on("uncaughtException", (err) => {
//   logger.error("Uncaught Exception! Shutting down...", {
//     message: err.message,
//     stack: err.stack,
//   });
//   process.exit(1);
// });

// // -----------------------------
// // Database Connection
// // -----------------------------
// connectDatabase();

// // -----------------------------
// // Server Start
// // -----------------------------
// const server = app.listen(process.env.PORT, () => {
//   logger.info(`Server is running on http://localhost:${process.env.PORT}`, {
//     port: process.env.PORT,
//     environment: process.env.NODE_ENV,
//   });
// });

// // -----------------------------
// // Unhandled Rejection Handler
// // -----------------------------
// process.on("unhandledRejection", (err) => {
//   logger.error("Unhandled Promise Rejection! Shutting down...", {
//     message: err.message,
//     stack: err.stack,
//   });

//   server.close(() => {
//     process.exit(1);
//   });
// });



import "dotenv/config";

import app from "./app.js";
import connectDatabase from "./config/db.js";
import logger from "./config/logger.js";

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception! Shutting down...", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

connectDatabase();

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