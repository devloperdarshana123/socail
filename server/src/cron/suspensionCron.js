
// // cron/suspensionCron.js
// import cron from "node-cron";
// import User from "../models/user.model.js";
// import logger from "../config/logger.js";
// import { sendMail } from "../utils/sendMail.js";
// import redis from "../config/redis.js";
// cron.schedule("0 * * * *", async () => {
//   try {
//     const expired = await User.find({
//       accountStatus: "suspended",
//       "activeSuspension.expiresAt": { $lte: new Date(), $ne: null },
//     }).select("username  email activeSuspension suspensionHistory");

//     if (!expired.length) {
//       logger.info("[CRON] No expired suspensions found");
//       return;
//     }

//     await Promise.all(
//       expired.map(async (user) => {
//         user.accountStatus    = "active";
//         user.activeSuspension = {
//           suspendedAt: null,
//           suspendedBy: null,
//           reason:      null,
//           duration:    null,
//           expiresAt:   null,
//         };
//         user.suspensionHistory.push({
//           action:      "unsuspended",
//           performedBy: null,
//           reason:      "Auto-lifted: suspension period expired",
//           createdAt:   new Date(),
//         });
//         await user.save({ validateBeforeSave: false });
//         await redis.del(`user:${user._id}`).catch(() => {});
//         logger.info(`[CRON] Auto-lifted suspension for @${user.username}`);
//       })
//     );

//     logger.info(`[CRON] Auto-lifted ${expired.length} suspensions`);

//   } catch (err) {
//     logger.error("[CRON] suspensionCron failed", { err });

//     // ✅ Admin alert email
//     try {
//       await sendMail({
//         to:      process.env.ADMIN_ALERT_EMAIL,
//         toName:  "Erovians Admin",
//         subject: "🚨 Suspension Cron Job Failed",
//         html: `
//           <h2>Suspension Cron Failed</h2>
//           <p><strong>Time:</strong> ${new Date().toISOString()}</p>
//           <p><strong>Error:</strong> ${err.message}</p>
//           <pre style="background:#f4f4f4;padding:12px;border-radius:6px">${err.stack}</pre>
//           <p>Please check server logs immediately.</p>
//         `,
//       });
//     } catch (mailErr) {
//       logger.error("[CRON] Failed to send cron alert email", { mailErr });
//     }
//   }
// });



// cron/suspensionCron.js
import cron from "node-cron";
import prisma from "../config/prisma.js";
import logger from "../config/logger.js";
import { sendMail } from "../utils/sendMail.js";
import redis from "../config/redis.js";

cron.schedule("0 * * * *", async () => {
  try {
    // activeSuspension is a Json field — filter in JS after fetch
    const suspended = await prisma.user.findMany({
      where: { accountStatus: "suspended" },
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
        await prisma.$transaction([
          // 1. Lift suspension
          prisma.user.update({
            where: { id: user.id },
            data: {
              accountStatus:    "active",
              activeSuspension: null,
            },
          }),

          // 2. Add to suspension history
          prisma.suspensionHistory.create({
            data: {
              userId:      user.id,
              action:      "unsuspended",
              performedBy: "system",
              reason:      "Auto-lifted: suspension period expired",
            },
          }),
        ]);

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