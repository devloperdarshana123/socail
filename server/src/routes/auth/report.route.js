import express              from "express";
import { isAuthenticated }  from "../../middlewares/auth.js";
import { submitReport }     from "../../controllers/auth/report.controller.js";
import rateLimit            from "express-rate-limit";

// Extra HTTP-level rate limit — controller ke andar bhi DB-level check hai
// Dono layers = production-grade defense in depth
const reportLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: "Too many report requests. Please wait a minute.",
  },
});

const router = express.Router();

router.post("/", isAuthenticated, reportLimiter, submitReport);

export default router;