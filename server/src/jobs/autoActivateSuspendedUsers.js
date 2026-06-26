import cron from "node-cron";
import prisma from "../config/prisma.js";
import logger from "../config/logger.js";
import { sendMail } from "../utils/sendMail.js";
import { accountActivated } from "../mail/templates/accountActivated.js";

export const startAutoActivateJob = () => {
  // हर hour चलेगा
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();

      // Find expired suspensions
      const expiredUsers = await prisma.user.findMany({
        where: {
          accountStatus: "suspended",
          activeSuspension: {
            expiresAt: { lte: now },
          },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          activeSuspension: true,
        },
      });

      if (expiredUsers.length === 0) return;

      // Activate them
      for (const user of expiredUsers) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountStatus: "active",
            activeSuspension: null,
          },
        });

        // Send email
        if (user.email) {
          sendMail({
            to: user.email,
            toName: user.fullName,
            subject: "Your account has been reactivated",
            html: accountActivated({
              fullName: user.fullName,
            }).html,
          }).catch((err) => {
            logger.error("Failed to send reactivation email", { userId: user.id });
          });
        }

        logger.info("Auto-activated suspended user", {
          userId: user.id,
          wasExpiredAt: user.activeSuspension?.expiresAt,
        });
      }

      logger.info("Auto-activate job completed", {
        usersActivated: expiredUsers.length,
      });
    } catch (error) {
      logger.error("Auto-activate job error", { error: error.message });
    }
  });

  logger.info("Auto-activate job started");
};