// import express from "express";
// import { getNearbySellers, updateLocation } from "../controllers/marketplace.controller.js";
// import { protect } from "../middleware/auth.middleware.js";

// const router = express.Router();

// router.get("/sellers", protect, getNearbySellers);
// router.put("/location", protect, updateLocation);

// export default router;


import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { getNearbySellers, updateLocation } from "../controllers/settings.controller.js";

const router = express.Router();

// GET /api/marketplace/sellers?lat=..&lng=..&maxDistance=..&category=..
router.get("/sellers",  protect, getNearbySellers);

// PUT /api/marketplace/location
router.put("/location", protect, updateLocation);

export default router;