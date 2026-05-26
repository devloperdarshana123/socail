export const ENV = {
  // JWT
  ACCESS_TOKEN_SECRET:  process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY:  process.env.ACCESS_TOKEN_EXPIRY  || "15m",
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || "7d",

  // Server
  NODE_ENV:  process.env.NODE_ENV  || "development",
  PORT:      process.env.PORT      || "9080",
  MONGO_URI: process.env.MONGO_URI,

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
};