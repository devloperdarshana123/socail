# Erovians server — integration test harness

Real-database integration tests. Built to unblock the Milestone 5
repository refactor: "zero behavioral change" can only be verified
meaningfully against a real Postgres, and this environment has no Docker.

## What it does

`tests/setup/globalSetup.js` (Jest `globalSetup`) starts a real,
disposable **PostgreSQL 18.4** via the `embedded-postgres` package — no
Docker, no system Postgres install — then runs the **actual production
migrations** (`prisma migrate deploy`, the same command `npm start` uses)
against it. Every test in `tests/integration/` therefore runs against the
exact schema production runs.

`tests/setup/globalTeardown.js` stops the instance and deletes the
throwaway data directory. The `.pgdata/` dir and `.test-env.json` file are
gitignored.

## Running

```bash
cd server
npx cross-env NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --forceExit
```

`--forceExit` is needed because of the Windows process-lingering quirk
noted below: the tests finish and teardown runs, but the embedded
`postgres.exe` child can keep the Node process alive past exit. `--forceExit`
makes Jest exit once teardown completes. (It's safe here — the only
lingering handle is that external process, not a leaked in-test resource.)

Note: the existing `npm test` script uses `NODE_ENV=test <cmd>` inline
syntax, which does not work under Windows `cmd.exe` (npm's default script
shell). That is a **pre-existing** cross-platform issue, unrelated to this
harness. Until it's fixed (e.g. with `cross-env`), invoke Jest's JS
entrypoint directly via a POSIX shell as above, or run on Linux/macOS
where the existing script works as-is.

## Design notes

- **Encoding**: the embedded cluster is initialized with
  `--encoding=UTF8 --locale=C`. Without this, `initdb` inherits the host
  OS locale (e.g. `WIN1252` on an "English_India" Windows install), which
  cannot store the literal emoji default in the real schema
  (`Like.reaction @default("❤️")`) — migrations fail with a
  "character has no equivalent in encoding" error.
- **Env propagation**: `globalSetup` writes the test `DATABASE_URL` to
  `.test-env.json`; `tests/setup/jestEnv.js` (a Jest `setupFiles` entry)
  reads it into `process.env` in each test file's context *before* any
  module — including Prisma Client — is imported. This is deliberate:
  Jest does not guarantee `globalSetup`'s own `process.env` mutations are
  visible inside the test run.

## Known limitation (Windows)

`embedded-postgres`'s `stop()` can return before the `postgres.exe`
process fully terminates on Windows, occasionally leaving an orphan
holding port 55432 that would block the next run. If a run fails to start
with a port-in-use error, clear it once with:

```powershell
Get-Process postgres -ErrorAction SilentlyContinue | Stop-Process -Force
```

In a normal full run the orphan is reaped when the Node process exits
(via the package's exit hook), so this is only an occasional issue.
