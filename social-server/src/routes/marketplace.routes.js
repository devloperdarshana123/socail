import express from "express";
import { getNearbySellers, updateLocation } from "../controllers/marketplace.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/sellers", protect, getNearbySellers);
router.put("/location", protect, updateLocation);

export default router;