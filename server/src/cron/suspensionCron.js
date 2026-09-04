

// cron/suspensionCron.js
import cron from "node-cron";
import { userRepository, suspensionHistoryRepository } from "../config/repositories.js";
import { transactionRunner } from "../config/transaction.js";
import logger from "../config/logger.js";
import { sendMail } from "../utils/sendMail.js";
import redis from "../config/redis.js";

cron.schedule("0 * * * *", async () => {
  try {
    // activeSuspension is a Json field — filter in JS after fetch
    const suspended = await userRepository.findManyOrdered({ accountStatus: "suspended" }, {
      select: {
        id:               true,
        username:         true,
        email:            true,
        activeSuspension: true,
      },
    });

    const now     = new Date();
    const expired = suspended.filter((u) => {
      const s = u.activeSuspension;
      return s?.expiresAt && new Date(s.expiresAt) <= now;
    });

    if (!expired.length) {
      logger.info("[CRON] No expired suspensions found");
      return;
    }

    await Promise.all(
      expired.map(async (user) => {
        // The LAST array-form $transaction in the codebase, converted to the
        // callback runner (the M-13 conversion). Element order is preserved
        // by awaiting sequentially, and the pair still commits or rolls back
        // together — a failed history write must not leave the account
        // silently un-suspended with no audit trail.
        await transactionRunner.run(async (tx) => {
          // 1. Lift suspension
          await userRepository.update(
            user.id,
            { accountStatus: "active", activeSuspension: null },
            { tx },
          );

          // 2. Add to suspension history
          await suspensionHistoryRepository.create(
            {
              userId:      user.id,
              action:      "unsuspended",
              performedBy: null,
              reason:      "Auto-lifted: suspension period expired",
            },
            { tx },
          );
        });

        // 3. Clear Redis cache
        await redis.del(`user:auth:${user.id}`).catch(() => {});

        logger.info(`[CRON] Auto-lifted suspension for @${user.username}`);
      })
    );

    logger.info(`[CRON] Auto-lifted ${expired.length} suspensions`);

  } catch (err) {
    logger.error("[CRON] suspensionCron failed", { err });

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