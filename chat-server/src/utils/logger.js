// src/utils/logger.js
import winston from "winston";

const { combine, timestamp, colorize, printf, json } = winston.format;

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const extras = Object.keys(meta).length ? JSON.stringify(meta) : "";
  return `${timestamp} [${level}]: ${message} ${extras}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",

  format: process.env.NODE_ENV === "production"
    ? combine(timestamp(), json())
    : combine(colorize(), timestamp({ format: "HH:mm:ss" }), devFormat),

  transports: [
    new winston.transports.Console(),

    // Production: file mein bhi save karo
    ...(process.env.NODE_ENV === "production"
      ? [
          new winston.transports.File({ filename: "logs/error.log",   level: "error" }),
          new winston.transports.File({ filename: "logs/combined.log" }),
        ]
      : []),
  ],
});

export default logger;