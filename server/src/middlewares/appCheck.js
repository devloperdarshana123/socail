// middlewares/appCheck.js
//
// Verifies the Firebase App Check token the client attaches as
// X-Firebase-AppCheck (see client/src/lib/services/api.js). Defaults to
// monitor mode — logs failures but never blocks — so it's safe to deploy
// before the reCAPTCHA site key is configured on the client. Flip
// APP_CHECK_ENFORCE=true once the App Check metrics dashboard shows a clean
// pass rate.
import admin, { firebaseReady } from "../config/firebase.js";
import logger from "../config/logger.js";

const ENFORCE = process.env.APP_CHECK_ENFORCE === "true";

export const verifyAppCheck = async (req, res, next) => {
  const token = req.header("X-Firebase-AppCheck");

  if (!firebaseReady) return next();

  if (!token) {
    if (ENFORCE) {
      return res.status(401).json({ success: false, message: "Missing App Check token" });
    }
    logger.warn("App Check token missing (monitor mode)", { path: req.originalUrl });
    return next();
  }

  try {
    await admin.appCheck().verifyToken(token);
    return next();
  } catch (err) {
    if (ENFORCE) {
      return res.status(401).json({ success: false, message: "Invalid App Check token" });
    }
    logger.warn("App Check verification failed (monitor mode)", { path: req.originalUrl, error: err.message });
    return next();
  }
};
