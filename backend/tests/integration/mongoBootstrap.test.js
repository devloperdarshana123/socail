// PHASE 8 PART 1 — a Mongo deployment must not need a generated Prisma client.
//
// The blocker this pins: `config/repositories.js` imported `@prisma/client`
// at the top level, purely for the `Prisma.JsonNull` sentinel that only
// PrismaUserRepository.findUsersWithLocation() uses. That made a GENERATED
// client a hard startup dependency of a Mongo-only deployment — the process
// died on import, before reaching any Mongo code, because `prisma generate`
// had never been run there.
//
// ── WHY A CHILD PROCESS ──────────────────────────────────────────────────
// A grep proves there is no STATIC import. It cannot prove that no DYNAMIC
// import reaches Prisma at load time, which is exactly what the fix relies
// on. So each case runs in a real Node process with an ESM resolve hook that
// throws on any attempt to load Prisma, and the boot path is exercised for
// real.
//
// The second test is the negative control. Without it, a hook that silently
// did nothing would make the first test pass for the wrong reason.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const serverRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const LOADER = "./tests/setup/prismaPoisonLoader.mjs";

/** Boot a module graph in a child process with Prisma poisoned. */
function boot(entry, env) {
  try {
    const stdout = execFileSync(
      process.execPath,
      ["--experimental-loader", LOADER, "--input-type=module",
       "-e", `await import('${entry}'); console.log('BOOTED');`],
      { cwd: serverRoot, env: { ...process.env, ...env }, encoding: "utf8", stdio: "pipe" }
    );
    return { ok: stdout.includes("BOOTED"), output: stdout };
  } catch (err) {
    return { ok: false, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("Mongo bootstrap does not require Prisma", () => {
  test("DATABASE_PROVIDER=mongo boots the composition root with Prisma poisoned", () => {
    const r = boot("./src/config/repositories.js", { DATABASE_PROVIDER: "mongo" });
    expect(r.output).not.toMatch(/BOOT_TOUCHED_PRISMA/);
    expect(r.ok).toBe(true);
  }, 60000);

  test("DATABASE_PROVIDER=mongo boots the database lifecycle module too", () => {
    // config/database.js pulls in repositories.js AND config/mongodb.js, and
    // is what server.js and the /health route now use instead of reaching for
    // the Prisma client directly.
    const r = boot("./src/config/database.js", { DATABASE_PROVIDER: "mongo" });
    expect(r.output).not.toMatch(/BOOT_TOUCHED_PRISMA/);
    expect(r.ok).toBe(true);
  }, 60000);

  test("DATABASE_PROVIDER=mongo boots the transaction runner too", () => {
    const r = boot("./src/config/transaction.js", { DATABASE_PROVIDER: "mongo" });
    expect(r.output).not.toMatch(/BOOT_TOUCHED_PRISMA/);
    expect(r.ok).toBe(true);
  }, 60000);

  test("NEGATIVE CONTROL: the prisma path still loads Prisma, and the hook catches it", () => {
    // Proves the hook works. If this passed cleanly the tests above would be
    // meaningless — and it also confirms PostgreSQL behaviour is unchanged:
    // the default path still wants its client.
    const r = boot("./src/config/repositories.js", { DATABASE_PROVIDER: "" });
    expect(r.output).toMatch(/BOOT_TOUCHED_PRISMA/);
    expect(r.ok).toBe(false);
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────
describe("rollback drill — the provider switch, both directions", () => {
  // The documented rollback is a single configuration change: unset
  // DATABASE_PROVIDER and restart. No staging environment is available here,
  // so this is a CONFIGURATION-LEVEL drill — it verifies the exact mechanism
  // the runbook depends on, not a live traffic cutover. That distinction is
  // carried into the GO/NO-GO matrix rather than glossed.
  function resolveIn(env) {
    const out = execFileSync(
      process.execPath,
      ["--input-type=module", "-e",
       "const m = await import('./src/config/repositories.js');" +
       "console.log(JSON.stringify({ provider: m.DATABASE_PROVIDER, prismaNull: m.prisma === null }));"],
      { cwd: serverRoot, env: { ...process.env, ...env }, encoding: "utf8", stdio: "pipe" }
    );
    return JSON.parse(out.trim().split("\n").pop());
  }

  test("DATABASE_PROVIDER=mongo resolves to mongo and holds no Prisma client", () => {
    expect(resolveIn({ DATABASE_PROVIDER: "mongo" })).toEqual({ provider: "mongo", prismaNull: true });
  }, 60000);

  test("UNSETTING it rolls back to prisma — the exact rollback step", () => {
    // The runbook says "unset DATABASE_PROVIDER (it defaults to prisma)".
    // This is that claim, executed.
    const env = { ...process.env };
    delete env.DATABASE_PROVIDER;
    const out = execFileSync(
      process.execPath,
      ["--input-type=module", "-e",
       "const m = await import('./src/config/repositories.js');" +
       "console.log(JSON.stringify({ provider: m.DATABASE_PROVIDER, prismaNull: m.prisma === null }));"],
      { cwd: serverRoot, env, encoding: "utf8", stdio: "pipe" }
    );
    const r = JSON.parse(out.trim().split("\n").pop());
    expect(r.provider).toBe("prisma");
    expect(r.prismaNull).toBe(false); // the client is back
  }, 60000);

  test("an unrecognised value is REFUSED at startup, not silently ignored", () => {
    // `DATABASE_PROVIDER=mongodb` is the obvious typo. It used to pass through
    // verbatim, and since every consumer compares `=== "mongo"` the service
    // started cleanly and served PostgreSQL while reporting a provider nobody
    // configured. On a cutover that is the worst outcome available: you think
    // you are on Mongo, you are not, and the rollback changes nothing.
    expect(() => resolveIn({ DATABASE_PROVIDER: "mongodb" })).toThrow();
  }, 60000);

  test("case and whitespace are tolerated, so a stray newline is not an outage", () => {
    expect(resolveIn({ DATABASE_PROVIDER: " Mongo " }).provider).toBe("mongo");
  }, 60000);

  test("`postgres` and its aliases resolve to the Prisma path, not a startup failure", () => {
    // The rollback step is "unset DATABASE_PROVIDER". Under pressure an
    // operator is just as likely to set it to the name of the database they
    // are going back to — and refusing to boot at THAT moment turns a config
    // change into an outage. These resolve; genuinely unknown values below
    // still fail closed.
    for (const value of ["postgres", "postgresql", "PostgreSQL", "pg", "prisma"]) {
      expect(`${value}=${resolveIn({ DATABASE_PROVIDER: value }).provider}`)
        .toBe(`${value}=prisma`);
    }
  }, 60000);

  test("fail-closed still holds: an unknown provider never silently picks a backend", () => {
    // The property that matters is that no unrecognised value can quietly
    // land on EITHER datastore. "mongodb" is the typo that used to serve
    // PostgreSQL while reporting a provider nobody configured.
    for (const value of ["mongodb", "sqlite", "mysql", "mong", "postgress"]) {
      expect(() => resolveIn({ DATABASE_PROVIDER: value })).toThrow();
    }
  }, 60000);
});
