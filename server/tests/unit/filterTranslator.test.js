// Unit characterization for the neutral→Prisma filter translator
// (Phase 7B, Blocker M-1).
//
// This suite is the CONTRACT for the translator. Every assertion states a
// Prisma `where` object that the application produced BEFORE M-1, next to
// the neutral filter that must now produce it. If a mapping ever drifts,
// the emitted SQL changes and this fails — which is the whole point: the
// migration's promise is "identical PostgreSQL behaviour", and identical
// behaviour means an identical `where` reaching Prisma.
//
// Pure functions, no database — this is the only unit suite in the project;
// everything else is an integration characterization against real Postgres.
// The integration suites remain the proof that the WHOLE stack still
// behaves the same; this one pins the translation table itself.
import { toPrismaWhere, NEUTRAL_OPERATORS } from "../../../shared/database/repositories/queryHelpers/filtering.js";

describe("toPrismaWhere — pass-through operators (neutral spelling == Prisma spelling)", () => {
  // These operators are already backend-neutral vocabulary, so the neutral
  // DSL deliberately keeps Prisma's spelling. The translation is the
  // IDENTITY — which is what makes 66 of the migration's 102 call-sites a
  // zero-behaviour-change rename-free conversion.
  test("comparison operators translate to themselves", () => {
    const d1 = new Date("2026-01-01");
    const d2 = new Date("2026-02-01");
    expect(toPrismaWhere({ createdAt: { gte: d1, lte: d2 } }))
      .toEqual({ createdAt: { gte: d1, lte: d2 } });
    expect(toPrismaWhere({ createdAt: { gt: d1, lt: d2 } }))
      .toEqual({ createdAt: { gt: d1, lt: d2 } });
  });

  test("set operators translate to themselves", () => {
    expect(toPrismaWhere({ status: { in: ["pending", "under_review"] } }))
      .toEqual({ status: { in: ["pending", "under_review"] } });
    expect(toPrismaWhere({ status: { notIn: ["dismissed"] } }))
      .toEqual({ status: { notIn: ["dismissed"] } });
  });

  test("not translates to itself", () => {
    expect(toPrismaWhere({ role: { not: "super_admin" } }))
      .toEqual({ role: { not: "super_admin" } });
  });

  test("eq → equals (the one comparison operator that is renamed)", () => {
    // Prisma spells explicit equality `equals`; the neutral DSL spells it
    // `eq` to match the rest of the operator family (neq-style brevity) and
    // to keep one canonical spelling — bare `{ field: value }` remains the
    // idiomatic form and is untouched.
    expect(toPrismaWhere({ createdAt: { eq: null } })).toEqual({ createdAt: { equals: null } });
  });

  test("startsWith / endsWith translate to themselves", () => {
    expect(toPrismaWhere({ slug: { startsWith: "erov" } })).toEqual({ slug: { startsWith: "erov" } });
    expect(toPrismaWhere({ slug: { endsWith: "-2026" } })).toEqual({ slug: { endsWith: "-2026" } });
  });
});

describe("toPrismaWhere — renamed operators (Prisma-specific vocabulary)", () => {
  // The only operators whose spelling actually changes. Each is a pure
  // rename: same semantics, same index usage, same SQL.
  test("like + caseInsensitive → contains + mode:insensitive (the ILIKE path)", () => {
    expect(toPrismaWhere({ username: { like: "garv", caseInsensitive: true } }))
      .toEqual({ username: { contains: "garv", mode: "insensitive" } });
  });

  test("like WITHOUT caseInsensitive → contains, no mode key (case-SENSITIVE)", () => {
    // Absence of `mode` is meaningful in Prisma: it selects LIKE, not ILIKE.
    // The translator must not add `mode` by default or every substring
    // search in the app would silently change collation behaviour.
    const out = toPrismaWhere({ caption: { like: "Marble" } });
    expect(out).toEqual({ caption: { contains: "Marble" } });
    expect("mode" in out.caption).toBe(false);
  });

  test("caseInsensitive: false is honoured, not dropped", () => {
    const out = toPrismaWhere({ caption: { like: "Marble", caseInsensitive: false } });
    expect(out).toEqual({ caption: { contains: "Marble" } });
    expect("mode" in out.caption).toBe(false);
  });

  test("caseInsensitive also applies to startsWith / endsWith", () => {
    expect(toPrismaWhere({ slug: { startsWith: "Erov", caseInsensitive: true } }))
      .toEqual({ slug: { startsWith: "Erov", mode: "insensitive" } });
  });

  test("hasAny → hasSome (scalar list membership)", () => {
    expect(toPrismaWhere({ hashtags: { hasAny: ["marble"] } }))
      .toEqual({ hashtags: { hasSome: ["marble"] } });
  });

  test("or / and → OR / AND", () => {
    expect(toPrismaWhere({ or: [{ a: 1 }, { b: 2 }] })).toEqual({ OR: [{ a: 1 }, { b: 2 }] });
    expect(toPrismaWhere({ and: [{ a: 1 }, { b: 2 }] })).toEqual({ AND: [{ a: 1 }, { b: 2 }] });
  });
});

describe("toPrismaWhere — scalars, nulls and structure", () => {
  test("bare scalar equality passes through untouched", () => {
    expect(toPrismaWhere({ status: "pending", escalated: true, postId: "abc" }))
      .toEqual({ status: "pending", escalated: true, postId: "abc" });
  });

  test("bare null is preserved as null, NOT rewritten to { equals: null }", () => {
    // `claimedById: null` is how unclaimedOnly filters. Rewriting it would
    // still work on Prisma but would change the emitted query shape.
    expect(toPrismaWhere({ claimedById: null })).toEqual({ claimedById: null });
  });

  test("{ not: null } is preserved (the stale-claim sweep's predicate)", () => {
    expect(toPrismaWhere({ claimedById: { not: null } })).toEqual({ claimedById: { not: null } });
  });

  test("Date instances are passed by reference, not cloned or coerced", () => {
    const d = new Date("2026-08-02T00:00:00Z");
    const out = toPrismaWhere({ createdAt: { gte: d } });
    expect(out.createdAt.gte).toBe(d);
  });

  test("arrays as bare values are NOT auto-wrapped in { in: … }", () => {
    // The dead pre-M-1 helper did this. It would silently change a filter
    // on a scalar-list column (Post.media, User.hashtags) into a membership
    // test, so the new translator deliberately does not.
    expect(toPrismaWhere({ media: [] })).toEqual({ media: [] });
  });

  test("an empty filter stays empty (matches everything, as before)", () => {
    expect(toPrismaWhere({})).toEqual({});
    expect(toPrismaWhere()).toEqual({});
  });

  test("undefined values are stripped so an unset filter never narrows a query", () => {
    expect(toPrismaWhere({ status: undefined, postId: "p1" })).toEqual({ postId: "p1" });
  });

  test("the input object is never mutated", () => {
    const input = { username: { like: "x", caseInsensitive: true }, or: [{ a: 1 }] };
    const snapshot = JSON.parse(JSON.stringify(input));
    toPrismaWhere(input);
    expect(input).toEqual(snapshot);
  });
});

describe("toPrismaWhere — nested relation filters", () => {
  test("relation filters recurse, so inner operators translate too", () => {
    expect(toPrismaWhere({ author: { role: { not: "super_admin" } } }))
      .toEqual({ author: { role: { not: "super_admin" } } });

    expect(toPrismaWhere({ author: { username: { like: "garv", caseInsensitive: true } } }))
      .toEqual({ author: { username: { contains: "garv", mode: "insensitive" } } });
  });

  test("multi-level nesting recurses all the way down", () => {
    expect(toPrismaWhere({ post: { author: { role: { not: "super_admin" } } } }))
      .toEqual({ post: { author: { role: { not: "super_admin" } } } });
  });

  test("conditions inside or/and are translated, not passed through raw", () => {
    expect(toPrismaWhere({
      or: [
        { username: { like: "q", caseInsensitive: true } },
        { author: { fullName: { like: "q", caseInsensitive: true } } },
      ],
    })).toEqual({
      OR: [
        { username: { contains: "q", mode: "insensitive" } },
        { author: { fullName: { contains: "q", mode: "insensitive" } } },
      ],
    });
  });

  test("or nested inside and (and vice versa) recurses correctly", () => {
    expect(toPrismaWhere({
      and: [{ isDeleted: false }, { or: [{ a: 1 }, { b: { not: 2 } }] }],
    })).toEqual({
      AND: [{ isDeleted: false }, { OR: [{ a: 1 }, { b: { not: 2 } }] }],
    });
  });
});

describe("toPrismaWhere — real filter shapes from the application", () => {
  // Each of these is a verbatim shape the app builds today, expressed
  // neutrally, asserted against the exact Prisma object it produced before.
  test("admin user list: super_admin exclusion + 4-field case-insensitive search", () => {
    const neutral = {
      role: { not: "super_admin" },
      or: [
        { username:    { like: "garv", caseInsensitive: true } },
        { fullName:    { like: "garv", caseInsensitive: true } },
        { email:       { like: "garv", caseInsensitive: true } },
        { phoneNumber: { like: "garv", caseInsensitive: true } },
      ],
    };
    expect(toPrismaWhere(neutral)).toEqual({
      role: { not: "super_admin" },
      OR: [
        { username:    { contains: "garv", mode: "insensitive" } },
        { fullName:    { contains: "garv", mode: "insensitive" } },
        { email:       { contains: "garv", mode: "insensitive" } },
        { phoneNumber: { contains: "garv", mode: "insensitive" } },
      ],
    });
  });

  test("admin comment list: nested-relation OR search", () => {
    expect(toPrismaWhere({
      isDeleted: false,
      or: [
        { content: { like: "spam", caseInsensitive: true } },
        { author: { username: { like: "spam", caseInsensitive: true } } },
        { author: { fullName: { like: "spam", caseInsensitive: true } } },
      ],
    })).toEqual({
      isDeleted: false,
      OR: [
        { content: { contains: "spam", mode: "insensitive" } },
        { author: { username: { contains: "spam", mode: "insensitive" } } },
        { author: { fullName: { contains: "spam", mode: "insensitive" } } },
      ],
    });
  });

  test("audit-log date range accumulated across two branches", () => {
    const start = new Date("2026-01-01");
    const end   = new Date("2026-01-31T23:59:59.999Z");
    expect(toPrismaWhere({ createdAt: { gte: start, lte: end } }))
      .toEqual({ createdAt: { gte: start, lte: end } });
  });

  test("admin all-posts grid: nested author guard + caption search", () => {
    expect(toPrismaWhere({
      isDeleted: false,
      isDraft:   false,
      author:    { role: { not: "super_admin" } },
      caption:   { like: "quarry", caseInsensitive: true },
    })).toEqual({
      isDeleted: false,
      isDraft:   false,
      author:    { role: { not: "super_admin" } },
      caption:   { contains: "quarry", mode: "insensitive" },
    });
  });

  test("comment keyset cursor: OR of (older) / (same instant, lower id)", () => {
    const at = new Date("2026-08-01T12:00:00Z");
    expect(toPrismaWhere({
      postId: "p1",
      or: [
        { createdAt: { lt: at } },
        { createdAt: { eq: at }, id: { lt: "c9" } },
      ],
    })).toEqual({
      postId: "p1",
      OR: [
        { createdAt: { lt: at } },
        { createdAt: { equals: at }, id: { lt: "c9" } },
      ],
    });
  });

  test("explore search: caption OR hashtag membership, with author guards", () => {
    expect(toPrismaWhere({
      author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
      or: [
        { caption:  { like: "marble", caseInsensitive: true } },
        { hashtags: { hasAny: ["marble"] } },
      ],
    })).toEqual({
      author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
      OR: [
        { caption:  { contains: "marble", mode: "insensitive" } },
        { hashtags: { hasSome: ["marble"] } },
      ],
    });
  });

  test("stale-claim sweep: not-null + expiry cutoff", () => {
    const now = new Date();
    expect(toPrismaWhere({ claimedById: { not: null }, claimExpiresAt: { lte: now } }))
      .toEqual({ claimedById: { not: null }, claimExpiresAt: { lte: now } });
  });
});

describe("toPrismaWhere — unknown operators THROW (Blocker M-1's core guarantee)", () => {
  // The audit's #1 finding was that a Prisma-shaped filter reaching a Mongo
  // repository returns zero rows SILENTLY. A closed whitelist converts that
  // class of bug from a silent wrong answer into a loud failure at the
  // repository boundary — before any driver sees it.
  test("Prisma's own contains/mode are REJECTED — they are not neutral vocabulary", () => {
    expect(() => toPrismaWhere({ username: { contains: "x" } })).toThrow(/contains/);
    expect(() => toPrismaWhere({ username: { mode: "insensitive" } })).toThrow(/mode/);
  });

  test("Prisma's uppercase OR/AND/NOT are REJECTED", () => {
    expect(() => toPrismaWhere({ OR: [{ a: 1 }] })).toThrow(/OR/);
    expect(() => toPrismaWhere({ AND: [{ a: 1 }] })).toThrow(/AND/);
    expect(() => toPrismaWhere({ NOT: { a: 1 } })).toThrow(/NOT/);
  });

  test("Prisma-only relation quantifiers are REJECTED", () => {
    expect(() => toPrismaWhere({ members: { some: { userId: "u1" } } })).toThrow(/some/);
    expect(() => toPrismaWhere({ members: { every: { userId: "u1" } } })).toThrow(/every/);
    expect(() => toPrismaWhere({ members: { none: { userId: "u1" } } })).toThrow(/none/);
  });

  test("hasSome / hasEvery are REJECTED in favour of hasAny", () => {
    expect(() => toPrismaWhere({ hashtags: { hasSome: ["x"] } })).toThrow(/hasSome/);
  });

  test("a typo alongside a real operator throws", () => {
    expect(() => toPrismaWhere({ createdAt: { gte: new Date(), nott: 1 } })).toThrow(/nott/);
  });

  test("an unrecognised operator NEVER degrades into a match-everything filter", () => {
    // This is the concrete regression the whitelist exists to prevent. The
    // previous (dead) implementation destructured only gte/lte/gt/lt/in, so
    // `{ role: { not: "super_admin" } }` produced `role: {}` — which Prisma
    // matches against EVERY row, silently removing the super_admin guard
    // from every admin screen. Whatever the translator does with an operator
    // it does not recognise, it must never be "emit an empty object".
    expect(toPrismaWhere({ role: { not: "super_admin" } })).toEqual({ role: { not: "super_admin" } });
    expect(() => toPrismaWhere({ role: { gte: 1, bogus: 2 } })).toThrow(/bogus/);
  });

  test("DOCUMENTED LIMIT: a lone unknown key is read as a nested relation filter", () => {
    // `{ author: { role: "user" } }` (relation) and `{ role: { nott: "x" } }`
    // (typo) are structurally identical — both are one object holding one
    // non-operator key with a scalar value. Telling them apart needs schema
    // knowledge this layer deliberately does not have, so the translator
    // passes it through and Prisma's own validation rejects it, exactly as
    // it did before M-1. Pinned so the behaviour is a known limit rather
    // than an unexamined gap; schema-aware validation is a later phase.
    expect(toPrismaWhere({ role: { nott: "super_admin" } }))
      .toEqual({ role: { nott: "super_admin" } });

    // The Prisma vocabulary that actually caused Blocker M-1 is rejected by
    // name even in this position — that is what matters for the migration.
    expect(() => toPrismaWhere({ role: { contains: "admin" } })).toThrow(/contains/);
  });

  test("the error names the field and the offending operator", () => {
    expect(() => toPrismaWhere({ author: { role: { contains: "admin" } } }))
      .toThrow(/author\.role.*contains/s);
  });

  test("caseInsensitive alone, with no string operator, throws", () => {
    // Would otherwise emit a bare `{ mode: "insensitive" }`, which Prisma
    // rejects at runtime with a much less helpful message.
    expect(() => toPrismaWhere({ username: { caseInsensitive: true } })).toThrow(/caseInsensitive/);
  });

  test("the whitelist is exported so the Mongo translator can be checked against it", () => {
    expect(NEUTRAL_OPERATORS).toEqual(expect.arrayContaining([
      "eq", "not", "gt", "gte", "lt", "lte", "in", "notIn",
      "like", "startsWith", "endsWith", "caseInsensitive", "hasAny",
    ]));
  });
});
