# PostgreSQL → MongoDB cutover

The tool, the runbook, and the rollback plan. Phase 8.

PostgreSQL is the production datastore today. Mongo has never held production
data. Nothing here writes to, updates, or deletes anything in PostgreSQL —
the Prisma client is used for `findMany` and `count` only.

---

## Commands

```bash
node scripts/migrate-to-mongo/cli.js --dry-run
```

Reads every source row, maps it, validates it against the real mongoose
schema, and writes nothing. Reports per collection: source / inserted /
updated / skipped / failed / duplicates.

```bash
node scripts/migrate-to-mongo/cli.js --indexes-only
```

Syncs indexes to the schemas without touching data.

```bash
node scripts/migrate-to-mongo/cli.js
```

Pre-flight, indexes, data, derived fields, then validation. Exits non-zero if
validation finds anything — usable as a CI gate.

```bash
node scripts/migrate-to-mongo/cli.js --validate-only
```

Compares an already-migrated Mongo against PostgreSQL. Read-only on both.

```bash
node scripts/migrate-to-mongo/cli.js --only=user,post
```

Restricts to named collections, for re-running one after a fix.

Configuration is environment-only; no credential is hardcoded or printed.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL, read-only use |
| `MONGO_URI` | MongoDB target |
| `MONGO_DB_NAME` | target database |

---

## ID strategy

**ObjectIds, derived deterministically from the PostgreSQL uuid.**

```
_id = ObjectId(sha1(uuid)[0..24])
```

Keeping the uuids as `_id` was rejected: `_id` and all ~40 foreign keys are
typed `ObjectId` across 37 schemas, and retyping them to String would mean
redesigning the repository layer and breaking every `ref:` populate and the
translator's `id → _id` mapping.

Deriving rather than generating buys four properties the migration depends on:

- **Idempotent.** Re-running produces identical `_id`s, so every write is an
  upsert on a stable key. An interrupted run is resumed by re-running it.
- **Order-independent.** A child's foreign key is computable before the parent
  row exists, so collections migrate in any order.
- **No lookup table.** FK resolution is a pure function, so it cannot miss.
- **Independently verifiable.** The validator recomputes the same function
  from the PostgreSQL side rather than trusting the migration's own log.

Collision risk is 96 bits; per-collection count checks would surface one.

## Relationship strategy

Every Postgres FK becomes an ObjectId reference under the same field name.
Three shapes needed more than that:

| Source | Destination | Why |
|---|---|---|
| `Like.targetModel` + `postId`/`commentId`/`storyId` | `targetType` + `targetId` | Mongo collapses the three nullable FKs into one polymorphic pair. Rows whose declared target has no matching FK are **skipped and counted**, never guessed. |
| `Report.targetModel` + FKs | `targetType` + `targetId`, **and** the FKs | The admin UI populates `post`/`comment`/`reportedUser` by name, so both representations are kept. |
| `ConversationParticipant` rows | `Conversation.participantIds[]` | Mongo embeds the member list. `findByParticipant()` queries it — an empty array hides every thread from every user. |
| `HighlightStory` join table | `Highlight.storyRefs[]` | Ordered by the join row's `createdAt`, which is render order. |

The last two have no source column, so they are rebuilt in a **second pass**
(`derive.js`) from PostgreSQL — never from the Mongo documents, so a partial
migration cannot produce a partially-correct array.

This is also why the engine writes with `$set` rather than `replaceOne`: a
`replaceOne` re-run would send documents back without the derived fields and
silently empty both. The rehearsal caught exactly that.

## Counters

Copied verbatim, never recomputed. `followersCount`, `postsCount`,
`likesCount`, `unreadCount` and the rest are maintained incrementally by the
application; recomputing them at migration time would "fix" divergences the
product has already accounted for and would make the cutover a behaviour
change rather than a move. If a counter is wrong today it stays wrong, which
is the only option that keeps the cutover reversible.

## What is NOT migrated

| Excluded | Reason |
|---|---|
| `HighlightStory` | Join table; becomes `Highlight.storyRefs[]`. |
| `profiles` | Deprecated. Its fields were consolidated onto `users` in Phase 7 and nothing reads it. |
| `companies`, `companyMembers`, `roles`, `permissions`, `locations`, `categories`, `marketplaceListings`, `orders`, `quotes`, `contracts`, `payments`, `verificationCases`, `verificationDocuments` | Greenfield Milestone 2/4 domains with no PostgreSQL table. Migrating into them would mean inventing rows. |

---

## Cutover runbook

### Before the window

1. **Back up PostgreSQL.** `pg_dump` to durable storage, verify the dump
   restores into a scratch database. This is the rollback, and it is the only
   thing standing between a bad cutover and data loss.
2. Provision Mongo as a **replica set**. Transactions require one; the
   application uses them and will fail on a standalone server.
3. `node scripts/migrate-to-mongo/cli.js --dry-run` against a **restored copy**
   of the production dump. Expect `failed=0` and `duplicates=0`.
4. Resolve anything pre-flight reports. It lists PostgreSQL values that the
   Mongo enums will refuse — old categories, statuses from removed features.
   Extend the enum, clean the source, or accept the loss explicitly.

### The window

5. **Put the application in maintenance mode.** The migration is not
   online: rows written to PostgreSQL after the read has passed them will not
   appear in Mongo, and there is no change-data-capture step.
6. `node scripts/migrate-to-mongo/cli.js`. Indexes, data, derived fields,
   validation. **Non-zero exit means stop.**
7. Read the validation block. It must say counts, ids, relationships, fields
   and derived arrays all agree.
8. Switch `DATABASE_PROVIDER=mongo` and set `MONGO_URI`/`MONGO_DB_NAME` on
   **both** services. Restart server and chat-server.
9. Smoke-test on the real deployment: log in, load the explore feed, open a
   comment thread, follow someone, send a chat message, check a notification.
   Every one of these was a silent failure at some point in this migration.
10. Take the application out of maintenance mode.

### Cutover point

The cutover point is step 8. Before it, PostgreSQL is still authoritative and
abandoning costs only the maintenance window. After it, writes are going to
Mongo and PostgreSQL is a stale snapshot.

---

## Rollback

**The rollback does not reconstruct PostgreSQL from Mongo.** That path is not
supported, not tested, and not necessary. PostgreSQL is left untouched and
fully functional throughout, so rollback is a configuration change.

### Trigger

Roll back on any of:

- migration exits non-zero, or validation reports any failure
- a smoke test fails after the switch
- Mongo error rates or latency exceed the pre-cutover PostgreSQL baseline
- any data-loss or wrong-data report from a user

### Procedure

1. Maintenance mode on.
2. Unset `DATABASE_PROVIDER` (it defaults to `prisma`) on both services.
3. Restart server and chat-server.
4. Maintenance mode off.

PostgreSQL still holds everything it held at step 5, because nothing in this
tool writes to it.

### The one-way part

Writes accepted by Mongo **after** step 8 exist only in Mongo. A rollback
discards them. This is why the smoke test belongs in the maintenance window,
before real traffic: it bounds the loss to zero.

If the decision to roll back comes later, with real writes already in Mongo,
that is no longer a rollback — it is a reverse migration, and this tool does
not do it. The mitigation is to keep the maintenance window short and the
decision early.

### Mongo failure after the point of no return

If Mongo becomes unavailable once traffic is live, the application does not
degrade to PostgreSQL — `DATABASE_PROVIDER` is read once at startup and the
two datastores have diverged. The response is to restore Mongo, not to fail
over. Provision it accordingly: replica set, monitoring, backups from day one.

---

## Rehearsing

`backend/tests/integration/migration.cutover.test.js` runs the whole thing —
seed, migrate, validate, re-run — against a disposable embedded PostgreSQL and
a disposable Mongo replica set. It is part of the PostgreSQL suite, so a
change that breaks the migration breaks CI.

```bash
cd server && npx jest migration.cutover
```
