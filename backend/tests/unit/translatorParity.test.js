// Phase 7D / M-5 prerequisite — the two translators accept the SAME language.
//
// ── WHY THIS SUITE EXISTS ────────────────────────────────────────────────
// M-1 gave the application one neutral filter vocabulary and translated it
// to Prisma. `toMongoFilter` was left as the pre-M-1 stub: it understood
// only gte/lte/gt/lt/in, and was unused, so nothing noticed. Every one of
// the 97 Mongo repository methods M-5 has to write depends on it.
//
// The risk this guards against is precise: if the two translators accept
// different vocabularies, a filter that works on Postgres silently means
// something else — or nothing — on Mongo. That is the exact failure class
// M-1 existed to remove, reintroduced at the other end.
//
// So these tests assert PARITY, not implementation: the same neutral input
// must be ACCEPTED by both and REJECTED by both.
import {
  toPrismaWhere, toMongoFilter, NEUTRAL_OPERATORS,
} from "../../../shared/database/repositories/queryHelpers/filtering.js";
import {
  toPrismaData, toMongoUpdate, NEUTRAL_MUTATIONS,
} from "../../../shared/database/repositories/queryHelpers/mutation.js";

// Every filter shape the application actually builds, harvested from the
// M-1 conversion. If either translator chokes on one of these, a real
// endpoint breaks on that backend.
const REAL_FILTERS = [
  { status: "pending" },
  { claimedById: null },
  { role: { not: "super_admin" } },
  { claimedById: { not: null } },
  { status: { in: ["pending", "under_review"] } },
  { id: { notIn: ["a", "b"] } },
  { createdAt: { gte: new Date("2026-01-01"), lte: new Date("2026-02-01") } },
  { createdAt: { lt: new Date("2026-08-01") } },
  { expiresAt: { gt: new Date() } },
  { createdAt: { eq: new Date("2026-08-01") } },
  { username: { like: "garv", caseInsensitive: true } },
  { caption: { like: "Marble" } },
  { slug: { startsWith: "erov" } },
  { slug: { endsWith: "-2026" } },
  { hashtags: { hasAny: ["marble"] } },
  { author: { role: { not: "super_admin" } } },
  { post: { author: { role: { not: "super_admin" } } } },
  { or: [{ a: 1 }, { b: { not: 2 } }] },
  { and: [{ isDeleted: false }, { or: [{ a: 1 }, { b: 2 }] }] },
  {
    role: { not: "super_admin" },
    or: [
      { username: { like: "q", caseInsensitive: true } },
      { email: { like: "q", caseInsensitive: true } },
    ],
  },
  { postId: "p1", or: [{ createdAt: { lt: new Date() } }, { createdAt: { eq: new Date() }, id: { lt: "c9" } }] },
];

// Prisma vocabulary — must be refused by BOTH.
const PRISMA_SPELLINGS = [
  { username: { contains: "x" } },
  { username: { mode: "insensitive" } },
  { OR: [{ a: 1 }] },
  { AND: [{ a: 1 }] },
  { NOT: { a: 1 } },
  { members: { some: { userId: "u" } } },
  { members: { every: { userId: "u" } } },
  { members: { none: { userId: "u" } } },
  { hashtags: { hasSome: ["x"] } },
  { createdAt: { equals: new Date() } },
];

describe("M-5 prerequisite — filter translator parity", () => {
  test.each(REAL_FILTERS.map((f, i) => [i, f]))(
    "filter #%i is accepted by BOTH translators", (_i, filter) => {
      expect(() => toPrismaWhere(filter)).not.toThrow();
      expect(() => toMongoFilter(filter)).not.toThrow();
    }
  );

  test.each(PRISMA_SPELLINGS.map((f, i) => [i, f]))(
    "Prisma spelling #%i is rejected by BOTH translators", (_i, filter) => {
      expect(() => toPrismaWhere(filter)).toThrow();
      expect(() => toMongoFilter(filter)).toThrow();
    }
  );

  test("both reject the same unknown operator with the same vocabulary list", () => {
    const bad = { createdAt: { gte: new Date(), bogus: 1 } };
    let p, m;
    try { toPrismaWhere(bad); } catch (e) { p = e.message; }
    try { toMongoFilter(bad); } catch (e) { m = e.message; }
    expect(p).toContain("bogus");
    expect(m).toContain("bogus");
    // Same advertised vocabulary — a developer reading either message learns
    // the same DSL.
    for (const op of NEUTRAL_OPERATORS) {
      expect(p).toContain(op);
      expect(m).toContain(op);
    }
  });
});

describe("M-5 prerequisite — Mongo filter output is correct, not merely accepted", () => {
  test("comparison and set operators map to their $-prefixed forms", () => {
    expect(toMongoFilter({ n: { gte: 1, lte: 5 } })).toEqual({ n: { $gte: 1, $lte: 5 } });
    expect(toMongoFilter({ s: { in: ["a"] } })).toEqual({ s: { $in: ["a"] } });
    expect(toMongoFilter({ s: { notIn: ["a"] } })).toEqual({ s: { $nin: ["a"] } });
    expect(toMongoFilter({ r: { not: "x" } })).toEqual({ r: { $ne: "x" } });
    expect(toMongoFilter({ r: { eq: "x" } })).toEqual({ r: { $eq: "x" } });
  });

  test("like becomes an ESCAPED regex — a filter value cannot inject a pattern", () => {
    // Without escaping, a caption search for "a.b" would match "axb", and a
    // search for "(" would throw. Both are silent-wrong-answer bugs.
    expect(toMongoFilter({ c: { like: "a.b" } })).toEqual({ c: { $regex: "a\\.b" } });
    expect(toMongoFilter({ c: { like: "50% (x)" } }).c.$regex).toBe("50% \\(x\\)");
  });

  test("caseInsensitive adds $options:'i' — and its absence leaves it off", () => {
    expect(toMongoFilter({ c: { like: "M", caseInsensitive: true } }))
      .toEqual({ c: { $regex: "M", $options: "i" } });
    const sensitive = toMongoFilter({ c: { like: "M" } });
    expect(sensitive.c.$options).toBeUndefined();
  });

  test("startsWith / endsWith anchor the regex", () => {
    expect(toMongoFilter({ s: { startsWith: "er" } })).toEqual({ s: { $regex: "^er" } });
    expect(toMongoFilter({ s: { endsWith: "26" } })).toEqual({ s: { $regex: "26$" } });
  });

  test("or / and become $or / $and with translated members", () => {
    expect(toMongoFilter({ or: [{ a: { not: 1 } }, { b: 2 }] }))
      .toEqual({ $or: [{ a: { $ne: 1 } }, { b: 2 }] });
  });

  test("nested relation objects flatten to DOTTED PATHS", () => {
    // Postgres joins; Mongo does not. A dotted path is only valid when the
    // relation is embedded — where it is a separate collection the repository
    // must resolve it with $lookup. That decision is per-method, which is why
    // the translator emits the path and does not attempt the join itself.
    expect(toMongoFilter({ author: { role: { not: "x" } } }))
      .toEqual({ "author.role": { $ne: "x" } });
    expect(toMongoFilter({ post: { author: { role: "x" } } }))
      .toEqual({ "post.author.role": "x" });
  });

  test("bare scalars, null and Dates pass through unchanged", () => {
    const d = new Date("2026-08-02");
    expect(toMongoFilter({ a: 1, b: null, c: d, e: "x" })).toEqual({ a: 1, b: null, c: d, e: "x" });
  });

  test("undefined values are stripped, matching the Prisma side", () => {
    expect(toMongoFilter({ a: undefined, b: 1 })).toEqual({ b: 1 });
    expect(toPrismaWhere({ a: undefined, b: 1 })).toEqual({ b: 1 });
  });
});

describe("M-5 prerequisite — mutation translator parity", () => {
  const REAL_WRITES = [
    { likesCount: { inc: 1 } },
    { likesCount: { dec: 3 } },
    { snapshots: { append: { id: "s" } } },
    { snapshots: { replace: [] } },
    { groupAdmin: { link: "u1" } },
    { status: "active", isDeleted: false },
    { activeSuspension: { reason: "spam", duration: 7 } },
  ];

  test.each(REAL_WRITES.map((d, i) => [i, d]))(
    "write payload #%i is accepted by BOTH translators", (_i, data) => {
      expect(() => toPrismaData(data)).not.toThrow();
      expect(() => toMongoUpdate(data)).not.toThrow();
    }
  );

  test.each([
    [{ n: { increment: 1 } }], [{ n: { decrement: 1 } }],
    [{ a: { push: 1 } }], [{ a: { set: [] } }], [{ r: { connect: { id: "u" } } }],
  ])("Prisma write spelling %# is rejected by BOTH", (data) => {
    expect(() => toPrismaData(data)).toThrow();
    expect(() => toMongoUpdate(data)).toThrow();
  });

  test("dec becomes a NEGATED $inc — the one non-identity mapping", () => {
    expect(toMongoUpdate({ n: { dec: 3 } })).toEqual({ $inc: { n: -3 } });
    expect(toPrismaData({ n: { dec: 3 } })).toEqual({ n: { decrement: 3 } });
  });

  test("both advertise the same mutation vocabulary", () => {
    // A typo ALONGSIDE a real operator throws in both. A LONE unknown key
    // does not, in either — it is indistinguishable from a JSON-column
    // payload without schema knowledge, exactly as on the filter side. The
    // parity that matters is that the two behave the SAME way.
    let p, m;
    try { toPrismaData({ n: { inc: 1, bogus: 2 } }); } catch (e) { p = e.message; }
    try { toMongoUpdate({ n: { inc: 1, bogus: 2 } }); } catch (e) { m = e.message; }
    expect(p).toContain("bogus");
    expect(m).toContain("bogus");
    for (const op of NEUTRAL_MUTATIONS) {
      expect(p).toContain(op);
      expect(m).toContain(op);
    }
  });

  test("PARITY OF THE LIMIT: a lone unknown key passes through in BOTH", () => {
    // Pinned so the limitation stays symmetric. If one translator ever grew
    // stricter than the other, a payload would succeed on one backend and
    // throw on the other — worse than the shared limitation itself.
    expect(() => toPrismaData({ meta: { anything: 1 } })).not.toThrow();
    expect(() => toMongoUpdate({ meta: { anything: 1 } })).not.toThrow();
  });
});
