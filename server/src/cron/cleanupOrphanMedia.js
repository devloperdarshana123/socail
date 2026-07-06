import cron from "node-cron";
import cloudinary from "../config/cloudinaryConfig.js";
import logger from "../config/logger.js";

const ORPHAN_AGE_HOURS = 24;
const TEMP_PREFIX = "temp_uploads/";

const cleanupOrphans = async () => {
  const cutoff = Date.now() - ORPHAN_AGE_HOURS * 60 * 60 * 1000;

  for (const resourceType of ["image", "video"]) {
    try {
      let nextCursor = null;
      let totalDeleted = 0;

      do {
        const res = await cloudinary.api.resources({
          type: "upload",
          resource_type: resourceType,
          prefix: TEMP_PREFIX,
          max_results: 100,
          next_cursor: nextCursor,
        });

        const old = res.resources.filter(
          (r) => new Date(r.created_at).getTime() < cutoff
        );

        if (old.length) {
          await cloudinary.api.delete_resources(
            old.map((r) => r.public_id),
            { resource_type: resourceType }
          );
          totalDeleted += old.length;
        }

        nextCursor = res.next_cursor;
      } while (nextCursor);

      if (totalDeleted > 0) {
        logger.info(`Orphan cleanup: deleted ${totalDeleted} ${resourceType}(s)`);
      }
    } catch (err) {
      logger.error(`Orphan cleanup failed for ${resourceType}`, { error: err.message });
    }
  }
};

// Har ghante chalao
cron.schedule("0 * * * *", cleanupOrphans);

export default cleanupOrphans;