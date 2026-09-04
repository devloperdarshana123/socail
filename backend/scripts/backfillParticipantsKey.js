import prisma from "../src/config/prisma.js"; // path apne project ke hisab se adjust kar

async function backfillParticipantsKey() {
  console.log("Starting participantsKey backfill...");

  // Sirf 1-on-1 (non-group) conversations jinki key NULL hai
  const conversations = await prisma.conversation.findMany({
    where: {
      isGroup: false,
      participantsKey: null,
    },
    include: {
      members: {
        select: { userId: true },
      },
    },
    orderBy: { createdAt: "asc" }, // sabse purana pehle rakhenge (master copy)
  });

  console.log(`Found ${conversations.length} conversations without participantsKey`);

  const seenKeys = new Map(); // key -> conversationId (jo rakhna hai)
  let updated = 0;
  let merged = 0;

  for (const conv of conversations) {
    if (conv.members.length !== 2) {
      console.log(`Skipping ${conv.id} — has ${conv.members.length} members, not a clean DM`);
      continue;
    }

    const ids = conv.members.map((m) => m.userId).sort();
    const key = ids.join(":");

    if (!seenKeys.has(key)) {
      // First conversation with this key — keep it, set the key
      try {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { participantsKey: key },
        });
        seenKeys.set(key, conv.id);
        updated++;
      } catch (err) {
        console.error(`Failed to update ${conv.id}:`, err.message);
      }
    } else {
      // Duplicate found — merge messages into the kept conversation, then deactivate this one
      const keepId = seenKeys.get(key);
      console.log(`Duplicate found: merging ${conv.id} into ${keepId}`);

      try {
        await prisma.$transaction(async (tx) => {
          // Move all messages to the kept conversation
          await tx.message.updateMany({
            where: { conversationId: conv.id },
            data: { conversationId: keepId },
          });

          // Move message receipts
          await tx.messageReceipt.updateMany({
            where: { conversationId: conv.id },
            data: { conversationId: keepId },
          });

          // Deactivate the duplicate conversation (don't hard delete — safety)
          await tx.conversation.update({
            where: { id: conv.id },
            data: { isActive: false, participantsKey: null },
          });
        });
        merged++;
      } catch (err) {
        console.error(`Failed to merge ${conv.id} into ${keepId}:`, err.message);
      }
    }
  }

  console.log(`Done! Updated: ${updated}, Merged duplicates: ${merged}`);
}

backfillParticipantsKey()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });