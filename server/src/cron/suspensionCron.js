
// cron/suspensionCron.js
import cron from "node-cron";
import User from "../models/user.model.js";
import logger from "../config/logger.js";
import { sendMail } from "../utils/sendMail.js";
import redis from "../config/redis.js";
cron.schedule("0 * * * *", async () => {
  try {
    const expired = await User.find({
      accountStatus: "suspended",
      "activeSuspension.expiresAt": { $lte: new Date(), $ne: null },
    }).select("username  email activeSuspension suspensionHistory");

    if (!expired.length) {
      logger.info("[CRON] No expired suspensions found");
      return;
    }

    await Promise.all(
      expired.map(async (user) => {
        user.accountStatus    = "active";
        user.activeSuspension = {
          suspendedAt: null,
          suspendedBy: null,
          reason:      null,
          duration:    null,
          expiresAt:   null,
        };
        user.suspensionHistory.push({
          action:      "unsuspended",
          performedBy: null,
          reason:      "Auto-lifted: suspension period expired",
          createdAt:   new Date(),
        });
        await user.save({ validateBeforeSave: false });
        await redis.del(`user:${user._id}`).catch(() => {});
        logger.info(`[CRON] Auto-lifted suspension for @${user.username}`);
      })
    );

    logger.info(`[CRON] Auto-lifted ${expired.length} suspensions`);

  } catch (err) {
    logger.error("[CRON] suspensionCron failed", { err });

    // ✅ Admin alert email
    try {
      await sendMail({
        to:      process.env.ADMIN_ALERT_EMAIL,
        toName:  "Erovians Admin",
        subject: "🚨 Suspension Cron Job Failed",
        html: `
          <h2>Suspension Cron Failed</h2>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Error:</strong> ${err.message}</p>
          <pre style="background:#f4f4f4;padding:12px;border-radius:6px">${err.stack}</pre>
          <p>Please check server logs immediately.</p>
        `,
      });
    } catch (mailErr) {
      logger.error("[CRON] Failed to send cron alert email", { mailErr });
    }
  }
});