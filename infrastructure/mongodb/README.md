# Erovians — Local MongoDB Infrastructure

Milestone 1 of the MongoDB migration (see the approved Phase 1 architecture
audit and Phase 2 MongoDB architecture design). This sets up a **locally
hosted, self-managed MongoDB Community Server** that runs *alongside* the
existing PostgreSQL/Prisma database — nothing is migrated, replaced, or
removed yet. Postgres remains the application's only load-bearing datastore
until a later milestone.

## Folder structure

```
infrastructure/
└── mongodb/
    ├── compose.yaml      # Docker Compose stack: mongod + one-shot init job
    ├── init.js           # Replica set initiation + app user creation script
    ├── .env.example       # Template for infra-only credentials (copy to .env)
    ├── .gitignore          # Keeps the real .env out of git
    └── README.md          # This file
```

Two services are defined in `compose.yaml`:

- **`mongodb`** — the actual MongoDB Community Server (`mongo:7.0`), started
  as a single-node replica set with authentication enabled from first boot.
- **`mongo-init`** — a one-shot job that runs once, after `mongodb` reports
  healthy, to initiate the replica set and create the application database
  user. It exits `0` and stops — seeing it as `Exited (0)` in
  `docker compose ps` is expected, not a failure.

## Startup instructions

```bash
cd infrastructure/mongodb
cp .env.example .env
# edit .env — set real values for MONGO_ROOT_PASSWORD and MONGO_PASSWORD
docker compose up -d
docker compose ps        # mongodb: healthy · mongo-init: Exited (0)
docker compose logs -f mongodb     # follow server logs
docker compose logs mongo-init     # confirm "[mongo-init] Initialization complete."
```

Then, in `server/.env`, set the matching `MONGO_URI` (see below) so the
backend can connect. Nothing else needs to change — the server starts and
runs normally whether or not this stack is up (see **Verification** below).

## Docker commands reference

| Command | Effect |
|---|---|
| `docker compose up -d` | Start (or resume) the stack in the background |
| `docker compose ps` | Check container/health status |
| `docker compose logs -f mongodb` | Tail the MongoDB server's logs |
| `docker compose logs mongo-init` | See the one-time init job's output |
| `docker compose down` | Stop the stack, **keep** data volumes |
| `docker compose down -v` | Stop the stack **and delete all data** — full reset, re-runs `mongo-init` on next `up` |
| `docker compose restart mongodb` | Restart just the server (rare — data and replica set state persist) |
| `docker compose exec mongodb mongosh -u <MONGO_ROOT_USER> -p <MONGO_ROOT_PASSWORD> --authenticationDatabase admin` | Open an authenticated shell against the running server |

## Environment variables

### `infrastructure/mongodb/.env` (infra-only — never read by the app)

| Variable | Purpose |
|---|---|
| `MONGO_ROOT_USER` / `MONGO_ROOT_PASSWORD` | Cluster superuser, created once by the official image on first boot. Used only to bootstrap the cluster and by `mongo-init`. The backend never authenticates as this user. |
| `MONGO_REPLICA_SET_NAME` | Replica set name (default `erovians-rs0`) |
| `MONGO_PORT` | Host port mapped to the container's `27017` (default `27017`) |
| `MONGO_DB_NAME` | The application database name — must match `server/.env`'s value |
| `MONGO_USER` / `MONGO_PASSWORD` | The least-privilege application user `mongo-init` creates (`readWrite` on `MONGO_DB_NAME` only) — must match `server/.env`'s values |

### `server/.env` (application-facing — see `server/.env.example` for the full list alongside the existing Postgres/JWT/etc. variables)

| Variable | Purpose |
|---|---|
| `MONGO_URI` | Full connection string the backend actually connects with, e.g. `mongodb://erovians_app:<password>@localhost:27017/erovians?replicaSet=erovians-rs0&authSource=erovians` |
| `MONGO_DB_NAME` | Same database name as above |
| `MONGO_USER` | Same application username as above (documented for scripts/tooling that need it outside the URI) |
| `MONGO_PASSWORD` | Same application password as above |
| `MONGO_AUTH_SOURCE` | The database the user's credentials are defined against — here, the same as `MONGO_DB_NAME`, since `mongo-init` creates the app user scoped to that one database |

**Note:** these are additive. Every existing PostgreSQL variable
(`DATABASE_URL`), every JWT secret, and every other existing variable in
`server/.env` is unchanged and still required — see `server/.env.example`.

## Security notes ("secure defaults")

- Authentication is enabled from the very first boot — there is no window
  where the server runs unauthenticated.
- Internal replica-set member authentication uses a randomly-generated
  keyfile, created inside a Docker-managed volume (never a host bind mount,
  which avoids the file-permission issues that commonly break MongoDB
  keyfiles on Windows/macOS Docker Desktop).
- The application only ever authenticates as the least-privilege
  `MONGO_USER`, scoped to `readWrite` on one database — never as the root
  user.
- Both `.env` files are gitignored; only the `.env.example` templates (no
  real secrets) are committed.
- Avoid `:`, `/`, `@`, `%`, `?` characters in `MONGO_ROOT_PASSWORD` unless
  percent-encoded — it's embedded directly into a connection string inside
  `compose.yaml`.

## Verification performed for this milestone

- `docker compose config` — validates the compose file's syntax and confirms
  every environment-variable interpolation (keyfile path escaping, the
  mongo-init connection string, healthcheck credentials) resolves correctly.
  This does **not** require the Docker daemon to be running.
- The backend's MongoDB connection module (`server/src/config/mongodb.js`)
  was exercised directly: with no Mongo env vars set (logs a warning,
  returns `null`, does not throw) and against an unreachable host (retries
  5 times with backoff, then gives up gracefully after ~55s without
  crashing or hanging indefinitely).
- Confirmed `server/src/server.js`'s existing startup/shutdown sequence is
  unchanged in behavior — the same pre-existing failure mode (missing Redis
  env vars) occurs at the same point it always did.
- **Not verified in this environment:** an actual `docker compose up`
  against a live Docker daemon, and a live Postgres connection — this
  sandbox has neither a running Docker daemon nor a running Postgres
  instance. Both need to be run once on a machine that has them (see
  Troubleshooting below for what to check).

## Troubleshooting

**`mongodb` container keeps restarting / logs mention keyfile permissions**
The keyfile is generated fresh inside a named Docker volume
(`erovians-mongo-keyfile`) on first start. If you previously experimented
with a host-mounted keyfile, remove that volume and let the container
regenerate it: `docker compose down -v` then `docker compose up -d`.

**`mongo-init` never becomes healthy / `mongodb` healthcheck keeps failing**
The healthcheck authenticates as the root user — double check
`MONGO_ROOT_USER`/`MONGO_ROOT_PASSWORD` in `infrastructure/mongodb/.env`
match what the container actually started with. If you changed them after
the first `docker compose up`, they won't take effect until you also reset
the volumes (`docker compose down -v`), since the root user is only created
once, on an empty data directory.

**`mongo-init` exits with a connection/auth error**
Usually means `mongodb` wasn't actually ready when `mongo-init` ran, or the
root credentials don't match. Check `docker compose logs mongodb` for the
server's own startup logs, and `docker compose logs mongo-init` for exactly
which step failed — `init.js` logs each step (`[mongo-init] ...`).

**Backend logs `[MongoDB] Skipping connection — missing environment
variable(s): ...`**
Expected and non-fatal if you haven't set up `server/.env`'s `MONGO_URI`/
`MONGO_DB_NAME` yet, or haven't started this compose stack. The app
continues running on Postgres alone.

**Backend logs repeated `[MongoDB] Connection attempt N/5 failed`**
The connection module retries with backoff before giving up gracefully.
Check that `docker compose ps` shows `mongodb` as `healthy`, that
`MONGO_PORT` in the compose `.env` matches the port in `server/.env`'s
`MONGO_URI`, and that the username/password/database name match exactly
across both `.env` files.

**Port `27017` already in use**
Another MongoDB instance (or a previous uncommitted attempt) may already be
bound to it. Change `MONGO_PORT` in `infrastructure/mongodb/.env` and update
the port in `server/.env`'s `MONGO_URI` to match.

**Existing Postgres/Prisma functionality seems affected**
It shouldn't be — this milestone made no changes to `prisma.js`,
`schema.prisma`, migrations, or any Postgres-related code path. If
something looks different, it's unrelated to this change; check
`git diff` against `server/src/config/prisma.js` and `server/prisma/` to
confirm they're untouched.
