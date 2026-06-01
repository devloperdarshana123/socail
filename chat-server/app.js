// app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import notifyRoutes from "./src/routes/notifyRoutes.js";
import healthRoutes from "./src/routes/healthRoutes.js";
import { errorHandler } from "./src/middleware/errorHandler.js";

dotenv.config();

const ALLOWED_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",")
  : ["http://localhost:5173", "http://localhost:5174"];

const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());

app.use("/notify", notifyRoutes);
app.use("/", healthRoutes);
app.use(errorHandler);

export default app;