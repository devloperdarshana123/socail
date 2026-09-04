// Phase 7C / M-8 — DATABASE_PROVIDER actually selects the implementation.
//
// ── THE DEFECT ───────────────────────────────────────────────────────────
// factory.js was written in Milestone 3 as "the one place DATABASE_PROVIDER
// is read", but the composition root never called it — every export was a
// hardcoded `new PrismaXRepository(prisma)`. The factory was therefore
// unreachable dead code and flipping DATABASE_PROVIDER did nothing at all.
// M-8 routes the root through the factory so the switch is real.
//
// It also carried a latent bug: `dualBacked()` never forwarded a `runtime`
// argument, so `createUserRepository()` would have produced a
// PrismaUserRepository WITHOUT the Prisma.JsonNull sentinel and
// findUsersWithLocation() would have thrown at call time. That only stayed
// invisible because nothing called the factory.
import {
  createUserRepository, createLikeRepository, createReportRepository,
  createCompanyRepository, resolveDatabaseProvider,
} from "../../../shared/database/repositories/factory.js";
import { PrismaUserRepository, MongoUserRepository } from "../../../shared/database/repositories/users/UserRepository.js";
import { PrismaLikeRepository, MongoLikeRepository } from "../../../shared/database/repositories/social/LikeRepository.js";
import { MongoCompanyRepository } from "../../../shared/database/repositories/companies/CompanyRepository.js";
import { PrismaReportRepository, MongoReportRepository } from "../../../shared/database/repositories/moderation/ReportRepository.js";

// A stand-in for the Prisma client — the factory only stores it.
const fakeClient = { $fake: true };

describe("M-8 — provider resolution", () => {
  const original = process.env.DATABASE_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = original;
  });

  test("defaults to prisma when DATABASE_PROVIDER is unset", () => {
    delete process.env.DATABASE_PROVIDER;
    expect(resolveDatabaseProvider()).toBe("prisma");
  });

  test("reads DATABASE_PROVIDER from the environment", () => {
    process.env.DATABASE_PROVIDER = "mongo";
    expect(resolveDatabaseProvider()).toBe("mongo");
  });

  test("an explicit argument overrides the environment", () => {
    process.env.DATABASE_PROVIDER = "mongo";
    expect(resolveDatabaseProvider("prisma")).toBe("prisma");
  });
});

describe("M-8 — the factory returns the class the provider selects", () => {
  test("provider 'prisma' yields Prisma-backed instances", () => {
    expect(createLikeRepository({ provider: "prisma", prismaClient: fakeClient }))
      .toBeInstanceOf(PrismaLikeRepository);
    expect(createReportRepository({ provider: "prisma", prismaClient: fakeClient }))
      .toBeInstanceOf(PrismaReportRepository);
  });

  test("provider 'mongo' yields Mongo-backed instances and IGNORES prismaClient", () => {
    const repo = createLikeRepository({ provider: "mongo", prismaClient: fakeClient });
    expect(repo).toBeInstanceOf(MongoLikeRepository);
    expect(repo).not.toBeInstanceOf(PrismaLikeRepository);
    // No Prisma client is retained on the Mongo path — importing the module
    // on a Mongo run must not imply a Postgres connection.
    expect(repo.prismaClient).toBeUndefined();
  });

  test("prisma without a client fails LOUDLY rather than building a broken repo", () => {
    expect(() => createLikeRepository({ provider: "prisma" }))
      .toThrow(/requires a prismaClient/);
  });

  test("greenfield domains always return Mongo, whatever the provider says", () => {
    // companies/roles/verification/locations/marketplace have no Postgres
    // precedent, so `provider` is accepted and deliberately ignored.
    expect(createCompanyRepository({ provider: "prisma", prismaClient: fakeClient }))
      .toBeInstanceOf(MongoCompanyRepository);
  });
});

describe("M-8 — the runtime argument reaches the Prisma constructor", () => {
  // This is the defect the M-8 rewiring exposed. Without it,
  // findUsersWithLocation() throws "requires the Prisma.JsonNull sentinel".
  const JSON_NULL = Symbol("Prisma.JsonNull");

  test("runtime is forwarded, so the JsonNull sentinel is present", () => {
    const repo = createUserRepository({
      provider: "prisma", prismaClient: fakeClient, runtime: { jsonNull: JSON_NULL },
    });
    expect(repo).toBeInstanceOf(PrismaUserRepository);
    expect(repo.jsonNull).toBe(JSON_NULL);
  });

  test("omitting runtime still constructs — but leaves the sentinel unset", () => {
    // Pinned as a known contract: the factory does not invent a sentinel, so
    // a caller that forgets `runtime` gets the documented loud failure from
    // findUsersWithLocation rather than a silently wrong query.
    const repo = createUserRepository({ provider: "prisma", prismaClient: fakeClient });
    expect(repo).toBeInstanceOf(PrismaUserRepository);
    expect(repo.jsonNull).toBeUndefined();
    return expect(repo.findUsersWithLocation([], {})).rejects.toThrow(/JsonNull/);
  });

  test("runtime is ignored on the Mongo path", () => {
    const repo = createUserRepository({
      provider: "mongo", prismaClient: fakeClient, runtime: { jsonNull: JSON_NULL },
    });
    expect(repo).toBeInstanceOf(MongoUserRepository);
  });
});

describe("M-8 — the composition root is wired to the factory", () => {
  test("it exports the resolved provider and defaults to postgres in tests", async () => {
    const mod = await import("../../src/config/repositories.js");
    expect(mod.DATABASE_PROVIDER).toBe("prisma");
  });

  test("every wired repository is a Prisma instance under the default provider", async () => {
    const mod = await import("../../src/config/repositories.js");
    // A representative slice across domains; all must be Prisma-backed.
    expect(mod.userRepository).toBeInstanceOf(PrismaUserRepository);
    expect(mod.likeRepository).toBeInstanceOf(PrismaLikeRepository);
    // …and the JsonNull sentinel survived the factory round-trip, which is
    // the whole point of the runtime fix above.
    expect(mod.userRepository.jsonNull).toBeDefined();
  });
});
