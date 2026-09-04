import winston, { format, transports as WinstonTransports } from "winston";
import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  quiet: true,
});

// ----------------------------
// Custom Color Definitions
// ----------------------------
const customColors = {
  error: "bold white redBG",
  warn: "bold black yellowBG",
  info: "bold black cyanBG",
  http: "bold white magentaBG",
};

winston.addColors(customColors);

// ----------------------------
// Development Console Format
// ----------------------------
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: "HH:mm:ss" }),
  format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

// ----------------------------
// Production Console Format
// ----------------------------
const productionFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` | ${JSON.stringify(meta)}`;
    }

    return log;
  })
);

// ----------------------------
// Transports Array
// ----------------------------
const loggerTransports = [];

// Development Transport
if (process.env.NODE_ENV === "development") {
  loggerTransports.push(
    new WinstonTransports.Console({
      format: consoleFormat,
    })
  );
}

// Production Transport
if (process.env.NODE_ENV === "production") {
  loggerTransports.push(
    new WinstonTransports.Console({
      format: productionFormat,
    })
  );
}

// ----------------------------
// Create Logger
// ----------------------------
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: loggerTransports,

  exceptionHandlers: [
    new WinstonTransports.Console({
      format: productionFormat,
    }),
  ],

  rejectionHandlers: [
    new WinstonTransports.Console({
      format: productionFormat,
    }),
  ],

  exitOnError: false,
});

export default logger;