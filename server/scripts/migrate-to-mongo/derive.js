import { models } from "../../../shared/database/mongodb/index.js";
import { oid } from "./ids.js";

// ── DERIVED FIELDS ───────────────────────────────────────────────────────
// Two Mongo fields have no Postgres column to copy from: they exist because
// Milestone 2 chose a different shape for a relationship Postgres expresses
// with a join table. Both are rebuilt here, AFTER the row-by-row pass, from
// the Postgres source of truth — not from the Mongo documents, so a partial
// migration cannot produce a partially-correct array.
//
// Both are written with $set of a fully rebuilt array, which makes them
// idempotent: re-running recomputes the same value rather than appending.

/**
 * Conversation.participantIds — Mongo embeds the member list on the thread,
 * Postgres keeps it only in ConversationParticipant.
 *
 * This matters more than it looks: ConversationRepository.findByParticipant()
 * queries `{ participantIds: userId }`. Leave it empty and every user's
 * conversation list is empty, with no error anywhere.
 */
export async function deriveParticipantIds(prisma, { dryRun, log }) {
  const rows = await prisma.conversationParticipant.findMany({
    select: { conversationId: true, userId: true },
    orderBy: { createdAt: "asc" }, // stable order in the embedded array
  });

  const byConversation = new Map();
  for (const r of rows) {
    if (!byConversation.has(r.conversationId)) byConversation.set(r.conversationId, []);
    byConversation.get(r.conversationId).push(oid(r.userId));
  }

  const ops = [];
  for (const [conversationId, participantIds] of byConversation) {
    ops.push({
      updateOne: {
        filter: { _id: oid(conversationId) },
        update: { $set: { participantIds } },
      },
    });
  }

  log(`  participantIds: ${ops.length} conversations from ${rows.length} membership rows`);
  if (dryRun || !ops.length) return { conversations: ops.length, memberships: rows.length, applied: 0 };

  const res = await models.Conversation.collection.bulkWrite(ops, { ordered: false });
  return {
    conversations: ops.length,
    memberships: rows.length,
    applied: res.modifiedCount ?? 0,
  };
}

/**
 * Highlight.storyRefs — Postgres keeps highlight↔story membership in the
 * HighlightStory join table; Mongo embeds it as `[{ storyId, addedAt }]`.
 *
 * Ordering is by the join row's createdAt, which is the order the stories
 * were added to the highlight and the order the app renders them in.
 */
export async function deriveStoryRefs(prisma, { dryRun, log }) {
  const rows = await prisma.highlightStory.findMany({
    select: { highlightId: true, storyId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byHighlight = new Map();
  for (const r of rows) {
    if (!byHighlight.has(r.highlightId)) byHighlight.set(r.highlightId, []);
    byHighlight.get(r.highlightId).push({
      storyId: oid(r.storyId),
      addedAt: new Date(r.createdAt),
    });
  }

  const ops = [];
  for (const [highlightId, storyRefs] of byHighlight) {
    ops.push({
      updateOne: {
        filter: { _id: oid(highlightId) },
        update: { $set: { storyRefs } },
      },
    });
  }

  log(`  storyRefs: ${ops.length} highlights from ${rows.length} join rows`);
  if (dryRun || !ops.length) return { highlights: ops.length, joins: rows.length, applied: 0 };

  const res = await models.Highlight.collection.bulkWrite(ops, { ordered: false });
  return { highlights: ops.length, joins: rows.length, applied: res.modifiedCount ?? 0 };
}

export const DERIVATIONS = [
  { name: "Conversation.participantIds", run: deriveParticipantIds },
  { name: "Highlight.storyRefs", run: deriveStoryRefs },
];
