// One-off backfill: rename legacy underscore comment audit actions to the
// canonical dot-notation values and fill in the missing "content" category.
// Only UPDATEs existing rows — nothing is deleted or created.

import prisma from "../src/config/prisma.js";

const RENAME_MAP = {
  comment_viewed:       "comment.viewed",
  comment_approved:     "comment.approved",
  comment_flagged:      "comment.flagged",
  comment_removed:      "comment.removed",
  comment_deleted:      "comment.deleted",
  comment_bulk_updated: "comment.bulk_updated",
};

async function main() {
  let totalUpdated = 0;

  for (const [oldAction, newAction] of Object.entries(RENAME_MAP)) {
    const result = await prisma.auditLog.updateMany({
      where: { action: oldAction },
      data:  { action: newAction, category: "content" },
    });

    if (result.count > 0) {
      console.log(`${oldAction} -> ${newAction}: ${result.count} row(s) updated`);
      totalUpdated += result.count;
    }
  }

  console.log(`Done. ${totalUpdated} row(s) updated total.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
