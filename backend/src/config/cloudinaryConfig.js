import { v2 as cloudinary } from "cloudinary";
import logger from "./logger.js";

// ✅ Env helper
const getEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

try {
  cloudinary.config({
    cloud_name: getEnv("CLOUDINARY_CLIENT_NAME"),
    api_key: getEnv("CLOUDINARY_CLIENT_API"),
    api_secret: getEnv("CLOUDINARY_CLIENT_SECRET"),
  });
  logger.info("Cloudinary configured successfully", {
    cloudName: process.env.CLOUDINARY_CLIENT_NAME,
  });
} catch (error) {
  logger.error("Cloudinary configuration failed", {
    message: error.message,
  });
  throw error; // ❗ app ko pata chalna chahiye ki config fail hua
}

export default cloudinary;