// cron/suspensionCron.js

import cron from "node-cron";
import User from "../models/user.model.js";
import logger from "../config/logger.js";

cron.schedule("0 * * * *", async () => {
  try {
    const expired = await User.find({
      accountStatus: "suspended",
      "activeSuspension.expiresAt": { $lte: new Date(), $ne: null },
    }).select("username activeSuspension suspensionHistory");

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
        logger.info(`[CRON] Auto-lifted suspension for @${user.username}`);
      })
    );

    logger.info(`[CRON] Auto-lifted ${expired.length} suspensions`);
  } catch (err) {
    logger.error("[CRON] suspensionCron failed", { err });
  }
});