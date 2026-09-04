# Cutover runbook

Companion to `README.md` (which covers the tool, the ID strategy and the
migration matrix). This is the sequence, the gate, and the rollback.

PostgreSQL is the production datastore today. Mongo has never held production
data. Nothing in this tool writes to, updates or deletes anything in
PostgreSQL — the Prisma client is used for `findMany` and `count` only.

---

## Commands

```bash
node scripts/migrate-to-mongo/cli.js --preflight --verbose --report=preflight.json
```

Inspects PostgreSQL only. No Mongo connection, nothing written. Produces the
classified findings report. **This is the gate.**

```bash
node scripts/migrate-to-mongo/cli.js --dry-run --report=dryrun.json
```

Maps and schema-validates every row; writes nothing.

```bash
node scripts/migrate-to-mongo/cli.js --report=migration.json
```

Preflight → indexes → data → derived fields → validation. Exits non-zero on
any BLOCKER or validation failure.

```bash
node scripts/migrate-to-mongo/cli.js --validate-only --report=validation.json
```

Read-only on both databases.

Other flags: `--indexes-only`, `--only=user,post`, `--verbose`, `--force`
(proceed despite BLOCKERs, recorded in the report).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL, read-only use |
| `MONGO_URI` | MongoDB target (replica set) |
| `MONGO_DB_NAME` | target database |

---

## Before any of this: the snapshot we need from you

Everything below is blocked on one input. The migration has been rehearsed
end-to-end on synthetic data, but synthetic data cannot contain the thing that
actually matters: values your production database has accumulated that the new
schema may not accept — a category from a removed feature, a status nobody
uses any more, two rows that the new uniqueness rules treat as one.

**What we need — a compressed dump, taken from a replica or during a quiet
period:**

```bash
pg_dump "$PRODUCTION_DATABASE_URL" --format=custom --no-owner --no-privileges -f erovians-prod.dump
```

Then tell us the file's size and the time it took, and transfer it over a
private channel.

**What we do with it.** Restore it into a throwaway database and run the
pre-flight report against that copy. Nothing connects to production, and no
step of this tool writes to PostgreSQL at all — proven by a test that wraps
the database client and records any write call, which comes back empty.

**Two things this buys, that nothing else can:**

1. The complete list of production values the new schema would reject, with
   row ids, before a maintenance window rather than during one.
2. A measured migration duration on real row counts — which is the only
   honest basis for agreeing a maintenance window.

**A live `.env` is not a substitute.** Application credentials point at the
running database; a rehearsal needs a restored copy that can be written to and
thrown away. We deliberately do not read or use production credentials for
this.

**On our side**, the restore needs `pg_dump`/`pg_restore` (PostgreSQL client
tools) and a MongoDB replica set available in the rehearsal environment.

---

## T-24h — rehearsal on a restored snapshot

Do this against a **restored copy**, never production.

```bash
pg_dump "$PRODUCTION_DATABASE_URL" -Fc -f prod.dump          # 1. back up
createdb erovians_rehearsal                                   # 2. scratch PG
pg_restore -d erovians_rehearsal prod.dump

export DATABASE_URL="postgresql://…/erovians_rehearsal"       # 3. point at scratch
export MONGO_URI="mongodb://localhost:27017"
export MONGO_DB_NAME="erovians_rehearsal"

node scripts/migrate-to-mongo/cli.js --preflight --verbose --report=preflight.json
```

**Resolve every BLOCKER before continuing.** For each finding the report gives
the model, field, problem, sample row ids, severity and a recommended action.
The three classes and what to do:

- *out-of-enum value* — add it to the enum in
  `shared/database/mongodb/constants/index.js`, or correct the source rows.
- *uniqueness violation* — de-duplicate at source; the migration will
  otherwise report those rows as failed.
- *unrepresentable polymorphic row* — a like or report declaring a target it
  has no FK for. These are **skipped**, so decide explicitly.

Then rehearse the whole thing:

```bash
node scripts/migrate-to-mongo/cli.js --dry-run --report=dryrun.json   # expect failed=0 duplicates=0
node scripts/migrate-to-mongo/cli.js --report=migration.json          # expect VALIDATION PASSED
node scripts/migrate-to-mongo/cli.js --report=rerun.json              # idempotency: inserted=0 everywhere
```

Record the elapsed time from `migration.json`. **That is your maintenance
window estimate** — it is the only honest source for one, because it depends
on production row counts.

Finally, point the application at the rehearsal Mongo and run the smoke list
below. Then verify indexes:

```bash
node scripts/migrate-to-mongo/cli.js --indexes-only --report=indexes.json
```

## T-1h

- Mongo is provisioned as a **replica set**. Transactions require one; the
  application uses them and fails on a standalone server.
- `MONGO_URI`, `MONGO_DB_NAME`, `DATABASE_PROVIDER` set on **both** services.
- Application build deployed and startable.
- Mongo-only deployments no longer need `prisma generate` — verified by
  `tests/integration/mongoBootstrap.test.js`. `@prisma/client` may still be
  installed; it is simply never loaded.
- `/health` responds. It is provider-aware and reports the active backend.
- **Redis is running and reachable by chat-server.** This is not optional.
  Message fan-out resolves a recipient's sockets through `onlineStore`,
  which is Redis-backed and whose errors are swallowed by design. With
  Redis down, messages are still accepted, persisted and counted but are
  never delivered — silent non-delivery, not data loss, and invisible in
  error rates. Verified by `chatserver.transport.mongo.test.js`.
- The `prod.dump` from T-24h is retained and restorable.

## Cutover

1. **Maintenance mode on.** The migration is offline: rows written to
   PostgreSQL after the read has passed them will not appear in Mongo, and
   there is no change-data-capture step.
2. Confirm application writes have stopped.
3. Final `pg_dump`. This is the rollback artifact.
4. `node scripts/migrate-to-mongo/cli.js --report=cutover.json`
5. Read the validation block. **Non-zero exit means stop and roll back.**
6. Set `DATABASE_PROVIDER=mongo` on server and chat-server. Restart both.
7. Run the smoke list. **This is inside the window, before real traffic** —
   that is what bounds rollback loss to zero.
8. Maintenance mode off.

### Smoke list

Check response *bodies*, not status codes. Every one of these was a silent
failure at some point in this migration — the endpoint returned 200 with
wrong or missing data.

| Area | Check |
|---|---|
| Auth | log in; refresh; log out; log in from a **second device** and confirm the first session survives |
| Feed | explore feed rows each carry a populated `author`; no posts from deactivated users or super-admins |
| Comments | thread renders with authors; replies nested; pinned replies sort first |
| Social | like then unlike (counter moves both ways); save; follow (both counters move); block |
| Stories | create; view; delete your own; deactivate then reactivate an account and confirm stories return |
| Messaging | open a conversation; send; edit; delete; react; seen; unread count |
| Admin | report queue with populated post/comment/reportedUser; audit log; admin notifications |

## Post-cutover monitoring

Watch for the first hour, then hourly for 24h:

- application error rate and 5xx count
- Mongo connection-pool saturation and available connections
- p50/p95 query latency against the pre-cutover PostgreSQL baseline
- failed writes and `MongoServerError` / `ValidationError` in logs
- authentication failure rate — the sharpest early signal
- socket connection count AND message delivery on chat-server —
  delivery is the signal that catches a Redis outage, because a Redis
  failure does not raise the error rate
- admin moderation actions completing

---

## Rollback

**Rollback is not bidirectional. Read this before the window, not during it.**

The rollback does **not** reconstruct PostgreSQL from Mongo. That path is not
supported, not tested, and not necessary — PostgreSQL is left untouched and
fully functional throughout, so rollback is a configuration change.

### Trigger

- migration exits non-zero, or validation reports any failure
- a smoke check fails after the switch
- error rate or latency materially exceeds the PostgreSQL baseline
- any data-loss or wrong-data report

### Procedure

1. Maintenance mode on.
2. Stop the Mongo-backed application.
3. Unset `DATABASE_PROVIDER` on both services — it defaults to `prisma`.
   Setting it explicitly to `prisma`, `postgres`, `postgresql` or `pg` works
   too; all four resolve to the PostgreSQL path. An unrecognised value
   (`mongodb`, a typo) refuses to start rather than quietly picking a
   backend, so a fat-fingered rollback fails loudly instead of appearing
   to succeed on the wrong datastore.
4. Restart server and chat-server.
5. Verify PostgreSQL: `/health` reports connected, and run the smoke list.
6. Maintenance mode off.
7. Investigate the Mongo failure with `cutover.json` and the application logs.

PostgreSQL still holds everything it held at cutover step 1, because nothing
in this tool writes to it.

### What rollback loses

> **Any write accepted by Mongo after the switch exists only in Mongo. A
> rollback discards it. There is no reverse migration.**

This is why the smoke list runs inside the maintenance window: with no real
traffic yet, the loss is zero. Once users are writing, a rollback trades their
data for stability, and that is a business decision, not an operational one.

### If Mongo fails after traffic is live

The application does **not** degrade to PostgreSQL. `DATABASE_PROVIDER` is
read once at startup, and by then the two datastores have diverged. The
response is to restore Mongo, not to fail over. Provision accordingly:
replica set, monitoring, and backups from day one.

---

## GO / NO-GO gate

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Mongo boots without a generated Prisma client | **GREEN** | `mongoBootstrap.test.js`, 10 tests, incl. negative control |
| 2 | Migration tool complete, all flags | **GREEN** | `--preflight/--dry-run/--validate-only/--indexes-only/--verbose/--report/--only/--force` |
| 3 | Synthetic rehearsal: migrate + validate | **GREEN** | `migration.cutover.test.js`, 33 tests |
| 4 | Idempotency by full state comparison | **GREEN** | second run byte-identical; derived arrays survive a data-only re-run |
| 5 | Indexes sync; no undeclared survivors | **GREEN** | `findUndeclaredIndexes()` returns empty |
| 6 | Nullable unique fields do not collide | **GREEN** | zero explicit nulls on sparse unique paths |
| 7 | Mongo application suite | **GREEN** | 7 suites / 138 tests |
| 8 | Chat-server suite | **GREEN** | 15 tests (10 handler + 5 live transport) |
| 9 | PostgreSQL regression | **GREEN** | 34 suites / 995 tests |
| 10 | Rollback procedure documented and mechanically simple | **GREEN** | config change only; PostgreSQL untouched |
| 11 | Rollback procedure *executed* | **YELLOW** | configuration-level drill passes (switch resolves both ways; an unknown value is refused). No staging environment, so no live-traffic drill |
| 12 | Socket.io wire layer (handshake, auth, rooms, persistence) | **GREEN** | `chatserver.transport.mongo.test.js`, 5 tests over a real websocket |
| 12b | Redis-backed fan-out and redis-adapter | **YELLOW** | no Redis in this environment (no daemon; Docker's daemon not running). Delivery path unexercised; deployment requirement documented at T-1h |
| 13 | Cutover duration estimate | **YELLOW** | needs a timed rehearsal on real row counts |
| 14 | **Preflight against a production snapshot** | **RED** | no dump available in this environment |
| 15 | **Migration + validation against a production snapshot** | **RED** | blocked on 14 |

### Decision

> **NOT READY FOR CUTOVER — awaiting production snapshot validation.**

Items 1–10 are done and evidenced. Items 14 and 15 cannot be satisfied here:
there is no production dump in this environment, and inventing results for
them would defeat the purpose of the gate.

Clear 14 and 15 by running the T-24h sequence against a restored dump. If
preflight reports zero BLOCKERs and the migration validates clean, items 13
and 11 resolve at the same time and the decision becomes **GO**.
