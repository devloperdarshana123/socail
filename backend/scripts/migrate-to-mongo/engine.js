import { models } from "../../../shared/database/mongodb/index.js";
import { PLAN } from "./plan.js";

// ── THE ENGINE ───────────────────────────────────────────────────────────
//
// Reads Postgres in id-ordered batches, maps each row through its plan entry,
// validates it against the real mongoose schema, and upserts by the derived
// `_id`.
//
// Three properties the cutover depends on:
//
//   READ-ONLY AT SOURCE. Only findMany/count are ever issued against Prisma.
//   There is no code path in this tool that writes to, or deletes from,
//   PostgreSQL.
//
//   IDEMPOTENT. `_id` is derived from the source uuid (see ids.js), so every
//   write is `replaceOne … upsert:true` on a stable key. Re-running converges
//   rather than duplicating, and an interrupted run is resumed by re-running.
//
//   TIMESTAMP-EXACT. Writes go through the raw driver collection, NOT through
//   a mongoose document save. Mongoose's timestamps plugin would stamp
//   updatedAt with the migration's own clock and destroy the source value.
//   Validation still happens — against the schema, before the write — so
//   nothing is written that the application could not have written itself.

const BATCH = 500;

/**
 * Remove keys whose value is `undefined` before the document is written.
 *
 * NOT cosmetic. The raw driver serialises an explicit `undefined` as `null`,
 * and a `sparse` unique index only skips documents where the field is ABSENT
 * — null is a value, and two nulls collide. User.username, email, phoneNumber
 * and firebaseUid are all `unique + sparse` and all optional, so without this
 * the second user without a phone number aborted the whole batch with
 * `E11000 dup key: { phoneNumber: null }`. The rehearsal caught it on the
 * second row; production would have hit it immediately.
 *
 * `null` is deliberately preserved: `deletedAt: null` is the schema's own
 * default and means "not deleted", which is different from "unknown".
 */
function prune(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const blank = () => ({
  source: 0, inserted: 0, updated: 0, skipped: 0, failed: 0,
  duplicates: 0, validationErrors: [],
});

/**
 * Validate a mapped document against its real mongoose schema without saving.
 * Returns an error message, or null when the document is acceptable.
 */
function validate(Model, doc) {
  const instance = new Model(doc);
  const err = instance.validateSync();
  if (!err) return null;
  return Object.entries(err.errors)
    .map(([path, e]) => `${path}: ${e.message}`)
    .join("; ");
}

/**
 * Migrate one plan entry.
 *
 * `onlyIds` restricts the run to a specific set of source ids — used by the
 * validator to re-check a sample, and by operators re-running a single row.
 */
export async function migrateEntry(entry, prisma, { dryRun, log, limit = null }) {
  const Model = models[entry.model];
  if (!Model) throw new Error(`Unknown Mongo model "${entry.model}"`);
  const delegate = prisma[entry.source];
  if (!delegate) throw new Error(`Unknown Prisma delegate "${entry.source}"`);

  const stats = blank();
  stats.source = await delegate.count();

  // Guards against a mapper that silently produces the same _id for two
  // different source rows — the one failure mode a derived id could have.
  const seen = new Set();

  let cursor = null;
  let processed = 0;

  for (;;) {
    const page = await delegate.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (!page.length) break;
    cursor = page[page.length - 1].id;

    const ops = [];
    for (const row of page) {
      processed += 1;
      let doc;
      try {
        doc = entry.map(row);
      } catch (err) {
        stats.failed += 1;
        if (stats.validationErrors.length < 10) {
          stats.validationErrors.push(`${row.id}: map threw — ${err.message}`);
        }
        continue;
      }
      // A mapper returns null for a row it cannot express. That is a decision,
      // not a failure — but it is counted and reported, never silent.
      if (doc === null) { stats.skipped += 1; continue; }

      const key = String(doc._id);
      if (seen.has(key)) {
        stats.duplicates += 1;
        if (stats.validationErrors.length < 10) {
          stats.validationErrors.push(`${row.id}: derived _id ${key} already used this run`);
        }
        continue;
      }
      seen.add(key);

      const problem = validate(Model, doc);
      if (problem) {
        stats.failed += 1;
        if (stats.validationErrors.length < 10) {
          stats.validationErrors.push(`${row.id}: ${problem}`);
        }
        continue;
      }

      // $set, NOT replaceOne. Two fields — Conversation.participantIds and
      // Highlight.storyRefs — have no Postgres column and are written by a
      // SECOND pass (derive.js). A replaceOne re-run would send the document
      // back without them and silently empty both, which the rehearsal caught:
      // every conversation lost its member list on the second run, and
      // findByParticipant() would then have returned nothing for everyone.
      // $set leaves fields the mapper does not mention alone.
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: prune(doc) },
          upsert: true,
        },
      });
    }

    if (ops.length && !dryRun) {
      const res = await Model.collection.bulkWrite(ops, { ordered: false, ignoreUndefined: true });
      stats.inserted += res.upsertedCount ?? 0;
      stats.updated += res.modifiedCount ?? 0;
    } else if (ops.length && dryRun) {
      // Dry run reports what WOULD be written, without distinguishing
      // insert from update — that distinction needs the destination.
      stats.inserted += ops.length;
    }

    if (limit && processed >= limit) break;
    if (page.length < BATCH) break;
  }

  const destination = dryRun ? null : await Model.countDocuments(
    entry.model === "Notification" ? { audience: entry.source === "adminNotification" ? "admin" : "user" } : {}
  );

  log(
    `  ${entry.source.padEnd(24)} src=${String(stats.source).padStart(7)}` +
    ` ins=${String(stats.inserted).padStart(7)}` +
    ` upd=${String(stats.updated).padStart(6)}` +
    ` skip=${String(stats.skipped).padStart(5)}` +
    ` fail=${String(stats.failed).padStart(5)}` +
    ` dup=${String(stats.duplicates).padStart(4)}` +
    (destination === null ? "" : ` dest=${destination}`)
  );
  for (const e of stats.validationErrors) log(`      ! ${e}`);

  return { ...stats, destination, model: entry.model };
}

export async function migrateAll(prisma, { dryRun, log, only = null }) {
  const entries = only
    ? PLAN.filter((e) => only.includes(e.source) || only.includes(e.model))
    : PLAN;
  const results = {};
  for (const entry of entries) {
    results[entry.source] = await migrateEntry(entry, prisma, { dryRun, log });
  }
  return results;
}
