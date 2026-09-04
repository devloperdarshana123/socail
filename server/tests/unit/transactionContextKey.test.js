// Phase 7B / M-2 — the transaction-context key is `tx` on BOTH backends.
//
// WHY THIS SUITE IS STRUCTURAL RATHER THAN BEHAVIOURAL
// The defect M-2 fixes lives in code that cannot be executed today: the
// Mongo implementations. DATABASE_PROVIDER is Postgres-only, mongoose is
// never connected, and there is no Mongo test harness. A behavioural test
// is therefore impossible — but the contract is still mechanically
// checkable, so this suite reads the repository sources and asserts the
// invariant directly.
//
// THE DEFECT
// Every helper passes `{ tx }`. Every Prisma method read `{ tx }`. Every
// Mongo method read `{ session }`. On a provider switch, `session` would
// have been `undefined` at all 194 Mongo methods → `.session(null)` → every
// write in all 19 transaction call-sites executes OUTSIDE its transaction,
// silently, with no error and no rollback. That is a data-integrity bug
// that would not surface until a partial failure corrupted something.
//
// These assertions are the regression barrier: reintroducing a `{ session }`
// binding anywhere in the repository layer fails here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(HERE, "../../../shared/database/repositories");

const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".js")) acc.push(p);
  }
  return acc;
};

const FILES = walk(REPO_DIR);

// Only EXECUTABLE code counts. The doc comments in this layer deliberately
// quote the old `{ session }` spelling to explain what M-2 changed, and the
// transaction runners legitimately own a local `session` variable — they are
// the code that CREATES the mongoose session. Neither is a binding.
const strip = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\/\/[^\n]*/g, "");

const REPOSITORY_FILES = FILES.filter((f) => !f.includes("transactions"));

/** Split a repository file into its Prisma-class and Mongo-class regions. */
const regions = (src) => {
  const mongoAt = src.indexOf("\nexport class Mongo");
  const prismaAt = src.indexOf("\nexport class Prisma");
  return {
    prisma: prismaAt >= 0 ? src.slice(prismaAt, mongoAt > prismaAt ? mongoAt : undefined) : "",
    mongo:  mongoAt >= 0 ? src.slice(mongoAt) : "",
  };
};

// Destructured option bindings, e.g. `{ tx }` / `{ tx, pagination = {} }`.
// Deliberately excludes `{ session: tx }`, which is mongoose's OWN option
// key receiving our value — that is the driver API and must not change.
const bindings = (region, key) =>
  (region.match(new RegExp(`\\{\\s*${key}\\s*[,}]`, "g")) || []).length;

describe("M-2 — one transaction-context key across both backends", () => {
  test("NO repository binds `session` as its option key", () => {
    const offenders = [];
    for (const f of REPOSITORY_FILES) {
      const src = strip(fs.readFileSync(f, "utf8"));
      // `{ session }` or `{ session, … }` as a destructured parameter.
      const hits = src.match(/\{\s*session\s*[,}]/g) || [];
      if (hits.length) offenders.push(`${path.basename(f)} (${hits.length})`);
    }
    expect(offenders).toEqual([]);
  });

  test("every Mongo class binds `tx`, matching its Prisma sibling", () => {
    const mismatches = [];
    for (const f of REPOSITORY_FILES) {
      const src = strip(fs.readFileSync(f, "utf8"));
      const { prisma, mongo } = regions(src);
      if (!mongo) continue;

      const mongoTx = bindings(mongo, "tx");
      const prismaTx = bindings(prisma, "tx");

      // A Mongo class with methods must bind `tx` at least once.
      const mongoMethods = (mongo.match(/^\s{2}async \w+\(/gm) || []).length;
      if (mongoMethods > 0 && mongoTx === 0) {
        mismatches.push(`${path.basename(f)}: ${mongoMethods} Mongo methods, 0 tx bindings`);
      }
      // Where both classes exist, neither may be left on the old key.
      if (prisma && /\{\s*session\s*[,}]/.test(prisma)) {
        mismatches.push(`${path.basename(f)}: Prisma class binds session`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("mongoose's own `session` option still receives the tx value", () => {
    // The KEY unified; the driver API did not. Every mongoose call must
    // still hand the context to mongoose under its own `session` name.
    let optionObjects = 0;
    let chained = 0;
    for (const f of REPOSITORY_FILES) {
      const { mongo } = regions(strip(fs.readFileSync(f, "utf8")));
      if (!mongo) continue;
      optionObjects += (mongo.match(/session:\s*tx/g) || []).length;
      // whitespace-tolerant: some call sites wrap the argument across lines
      chained       += (mongo.match(/\.session\([^)]*\)/g) || []).filter((x) => x.replace(/\s+/g, "") === ".session(tx??null)").length;
    }
    // Non-trivial counts prove the threading survived the rename rather
    // than the option being dropped.
    expect(optionObjects).toBeGreaterThan(50);
    expect(chained).toBeGreaterThan(200);
  });

  test("no mongoose option is left receiving an undefined binding", () => {
    const bad = [];
    for (const f of REPOSITORY_FILES) {
      const { mongo } = regions(strip(fs.readFileSync(f, "utf8")));
      if (!mongo) continue;
      // Whitespace is irrelevant to the contract — some call sites wrap the
      // argument across lines — so compare with ALL whitespace removed.
      const squash = (x) => x.replace(/\s+/g, "");

      // `session: <anything other than tx>` would mean the rename missed a site.
      for (const m of mongo.match(/session:\s*\w+/g) || []) {
        if (squash(m) !== "session:tx") bad.push(`${path.basename(f)}: ${m}`);
      }
      // `.session(x)` where x is not `tx ?? null`
      for (const m of mongo.match(/\.session\([^)]*\)/g) || []) {
        if (squash(m) !== ".session(tx??null)") bad.push(`${path.basename(f)}: ${m}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("MongoTransaction documents `tx` as the key its callback value travels under", () => {
    const src = fs.readFileSync(path.join(REPO_DIR, "transactions/MongoTransaction.js"), "utf8");
    expect(src).toMatch(/pass it as `\{ tx \}`/);
    // It must still hand a real mongoose ClientSession to the callback.
    expect(src).toMatch(/mongoose\.startSession\(\)/);
    expect(src).toMatch(/session\.withTransaction/);
    expect(src).toMatch(/callback\(session\)/);
  });

  test("PrismaTransaction is unchanged and still hands `tx` to its callback", () => {
    const src = fs.readFileSync(path.join(REPO_DIR, "transactions/PrismaTransaction.js"), "utf8");
    expect(src).toMatch(/\$transaction\(async \(tx\) => callback\(tx\)\)/);
    // Error identity preservation from Milestone 1 must still be intact.
    expect(src).toMatch(/TransactionError/);
  });

  test("both runners expose the same run(callback) contract", () => {
    const p = fs.readFileSync(path.join(REPO_DIR, "transactions/PrismaTransaction.js"), "utf8");
    const m = fs.readFileSync(path.join(REPO_DIR, "transactions/MongoTransaction.js"), "utf8");
    expect(p).toMatch(/async run\(callback\)/);
    expect(m).toMatch(/async run\(callback\)/);
    // Both normalize failures to TransactionError, so helper catch logic is
    // backend-independent.
    expect(p).toMatch(/throw new TransactionError/);
    expect(m).toMatch(/throw new TransactionError/);
  });
});
