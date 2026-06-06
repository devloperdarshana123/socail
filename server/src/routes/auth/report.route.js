

import express             from "express";
import { isAuthenticated } from "../../middlewares/auth.js";
import { submitReport }    from "../../controllers/auth/report.controller.js";
import { createRateLimiter } from "../../middlewares/rateLimiter.js";

const reportLimiter = createRateLimiter({
  route      : "report",
  limit      : 10,
  windowSecs : 60,
  message    : "Too many report requests. Please wait a minute.",
});

const router = express.Router();
router.post("/", isAuthenticated, reportLimiter, submitReport);
export default router;