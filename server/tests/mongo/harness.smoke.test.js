// Phase 7C / M-9 — proves the Mongo harness is operational.
//
// This is the ONLY Mongo suite that exists at this milestone, and it
// deliberately exercises the HARNESS, not any repository. M-9's contract is
// "the environment works and is trustworthy"; M-5/M-6/M-10 will consume it.
//
// ── HOW TO RUN ───────────────────────────────────────────────────────────
//     npm run test:mongo         # this suite only
//     npm test                   # Postgres suites — unchanged, Mongo excluded
//
// The two harnesses are separate jest projects because they need different
// globalSetup: the Postgres one boots embedded-postgres and runs Prisma
// migrations, which a Mongo run has no use for (and vice versa). Keeping
// them apart also means a broken/slow Mongo download can never block the
// Postgres suite that guards production today.
import { mongoose, models } from "../../../shared/database/mongodb/index.js";
import {
  startMongo, stopMongo, clearMongo, syncIndexes,
  isMongoReady, seed, clearModel, inRolledBackTransaction,
} from "./harness.js";

// NOTE: `jest` is not a global under ESM (established in Milestone 6), so
// the long first-run timeout is set in jest.mongo.config.js instead of here.

beforeAll(async () => {
  await startMongo();
  await syncIndexes();
}, 120_000);

afterAll(async () => {
  await stopMongo();
});

// Isolation: every test starts from empty collections.
afterEach(async () => {
  await clearMongo();
});

describe("M-9 — harness bootstrap", () => {
  test("connects to a real mongod", async () => {
    expect(isMongoReady()).toBe(true);
    // readyState 1 === connected. A mock would not have one.
    expect(mongoose.connection.readyState).toBe(1);
  });

  test("runs as a REPLICA SET, which is what makes transactions possible", async () => {
    // MongoDB refuses multi-document transactions on a standalone server, so
    // this is not a cosmetic detail — without it every transaction test in
    // M-5 would fail for infrastructure reasons rather than real ones.
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    expect(info.setName).toBeDefined();
    expect(info.isWritablePrimary ?? info.ismaster).toBe(true);
  });

  test("the shared models are registered and usable", async () => {
    expect(Object.keys(models).length).toBeGreaterThan(0);
    expect(typeof models.User?.create).toBe("function");
  });
});

describe("M-9 — seed and cleanup helpers", () => {
  test("seed.user creates a retrievable document", async () => {
    const u = await seed.user();
    expect(u._id).toBeDefined();
    expect(await models.User.countDocuments({ _id: u._id })).toBe(1);
  });

  test("seed accepts overrides", async () => {
    const u = await seed.user({ username: "explicit_name" });
    expect(u.username).toBe("explicit_name");
  });

  test("seed.many inserts in one round-trip", async () => {
    const base = await seed.user();
    await seed.many("SocialPost", [
      { authorId: base._id, type: "image", caption: "a" },
      { authorId: base._id, type: "image", caption: "b" },
    ]);
    expect(await models.SocialPost.countDocuments({ authorId: base._id })).toBe(2);
  });

  test("clearModel empties one collection without touching others", async () => {
    const u = await seed.user();
    await seed.post(u._id);
    await clearModel("SocialPost");
    expect(await models.SocialPost.countDocuments({})).toBe(0);
    expect(await models.User.countDocuments({})).toBe(1);
  });
});

describe("M-9 — test isolation", () => {
  // These two tests prove afterEach(clearMongo) actually isolates: the first
  // seeds data, the second asserts it is gone. If isolation ever broke, the
  // second would see the first's rows.
  test("seeds a user (visible only to this test)", async () => {
    await seed.user();
    expect(await models.User.countDocuments({})).toBe(1);
  });

  test("starts from an empty database", async () => {
    expect(await models.User.countDocuments({})).toBe(0);
  });

  test("clearMongo preserves indexes, so unique constraints still apply", async () => {
    // Dropping collections would silently drop the indexes declared in
    // shared/database/mongodb/indexes — and index behaviour is exactly what
    // M-5 will need to test. deleteMany keeps them.
    const idx = await models.User.collection.indexes();
    expect(idx.length).toBeGreaterThan(1); // more than just _id
  });
});

describe("M-9 — transaction support", () => {
  test("a committed transaction persists its writes", async () => {
    const session = await mongoose.startSession();
    let created;
    try {
      await session.withTransaction(async () => {
        [created] = await models.User.create(
          [{ username: `tx_${Date.now()}`, email: `tx-${Date.now()}@e.com`, passwordHash: "h", fullName: "Tx User" }],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    expect(await models.User.countDocuments({ _id: created._id })).toBe(1);
  });

  test("an aborted transaction rolls its writes back", async () => {
    await inRolledBackTransaction(async (session) => {
      await models.User.create(
        [{ username: `rb_${Date.now()}`, email: `rb-${Date.now()}@e.com`, passwordHash: "h", fullName: "Tx User" }],
        { session },
      );
      // visible INSIDE the transaction…
      expect(await models.User.countDocuments({}).session(session)).toBe(1);
    });
    // …and gone once it aborts.
    expect(await models.User.countDocuments({})).toBe(0);
  });

  test("a throw inside withTransaction aborts it", async () => {
    const session = await mongoose.startSession();
    await expect(
      session.withTransaction(async () => {
        await models.User.create(
          [{ username: `err_${Date.now()}`, email: `err-${Date.now()}@e.com`, passwordHash: "h", fullName: "Tx User" }],
          { session },
        );
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    await session.endSession();
    expect(await models.User.countDocuments({})).toBe(0);
  });
});

describe("M-9 — repository bootstrap readiness", () => {
  test("DATABASE_PROVIDER=mongo selects Mongo repositories (M-8 integration)", async () => {
    const { createUserRepository } = await import(
      "../../../shared/database/repositories/factory.js"
    );
    const { MongoUserRepository } = await import(
      "../../../shared/database/repositories/users/UserRepository.js"
    );
    const repo = createUserRepository({ provider: "mongo" });
    expect(repo).toBeInstanceOf(MongoUserRepository);
  });

  test("a Mongo repository can execute against the harness", async () => {
    // Deliberately the SIMPLEST possible call — M-9 does not implement or
    // validate repository behaviour, it only proves the wiring reaches a
    // live database so M-5 can start from a working baseline.
    const { createUserRepository } = await import(
      "../../../shared/database/repositories/factory.js"
    );
    const repo = createUserRepository({ provider: "mongo" });
    await seed.user();
    expect(await repo.count({})).toBe(1);
  });
});
