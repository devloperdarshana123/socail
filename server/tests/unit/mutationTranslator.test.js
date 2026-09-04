// Unit characterization for the neutral→Prisma mutation translator
// (Phase 7B, M-3).
//
// Every assertion states the Prisma `data` object the application produced
// BEFORE M-3 beside the neutral payload that must now produce it. The
// migration's promise is identical PostgreSQL behaviour, and for writes that
// means an identical `data` reaching Prisma — in particular that `inc`/`dec`
// still emit ATOMIC increment/decrement rather than a read-modify-write.
import {
  toPrismaData, toMongoUpdate, NEUTRAL_MUTATIONS,
} from "../../../shared/database/repositories/queryHelpers/mutation.js";

describe("toPrismaData — counter mutations", () => {
  test("inc / dec → increment / decrement (still ATOMIC, not read-modify-write)", () => {
    expect(toPrismaData({ commentsCount: { inc: 1 } }))
      .toEqual({ commentsCount: { increment: 1 } });
    expect(toPrismaData({ commentsCount: { dec: 1 } }))
      .toEqual({ commentsCount: { decrement: 1 } });
  });

  test("a variable amount is carried through unchanged", () => {
    // commentHelpers decrements by a computed subtree size, not always 1.
    expect(toPrismaData({ commentsCount: { dec: 7 } }))
      .toEqual({ commentsCount: { decrement: 7 } });
    expect(toPrismaData({ reactionsCount: { inc: -1 } }))
      .toEqual({ reactionsCount: { increment: -1 } });
  });

  test("a dynamic field name (userHelpers.updateCount) still works", () => {
    const field = "followersCount";
    expect(toPrismaData({ [field]: { inc: 3 } }))
      .toEqual({ followersCount: { increment: 3 } });
  });

  test("several counters in one payload", () => {
    expect(toPrismaData({ likesCount: { inc: 1 }, viewsCount: { inc: 1 }, savedCount: { dec: 1 } }))
      .toEqual({
        likesCount: { increment: 1 }, viewsCount: { increment: 1 }, savedCount: { decrement: 1 },
      });
  });
});

describe("toPrismaData — scalar lists and relations", () => {
  test("append → push (highlight snapshots)", () => {
    const snap = { id: "s1", url: "u" };
    expect(toPrismaData({ snapshots: { append: snap } }))
      .toEqual({ snapshots: { push: snap } });
  });

  test("replace → set (whole-list overwrite)", () => {
    const list = [{ id: "a" }, { id: "b" }];
    expect(toPrismaData({ snapshots: { replace: list } }))
      .toEqual({ snapshots: { set: list } });
  });

  test("link → connect, accepting a bare id or an explicit target", () => {
    expect(toPrismaData({ groupAdmin: { link: "u1" } }))
      .toEqual({ groupAdmin: { connect: { id: "u1" } } });
    expect(toPrismaData({ groupAdmin: { link: { id: "u1" } } }))
      .toEqual({ groupAdmin: { connect: { id: "u1" } } });
  });
});

describe("toPrismaData — plain data passes through untouched", () => {
  test("scalars, nulls, Dates and arrays are ordinary assignments", () => {
    const d = new Date("2026-08-02");
    const out = toPrismaData({
      status: "active", isDeleted: false, count: 0, deletedAt: null,
      createdAt: d, media: [{ url: "x" }],
    });
    expect(out).toEqual({
      status: "active", isDeleted: false, count: 0, deletedAt: null,
      createdAt: d, media: [{ url: "x" }],
    });
    expect(out.createdAt).toBe(d); // by reference, not cloned
  });

  test("a JSON-column payload is DATA, not instructions", () => {
    // activeSuspension is a Json column whose keys are ordinary field names.
    // Reading them as operators would corrupt every suspension write.
    const suspension = {
      suspendedAt: new Date("2026-08-01"), suspendedBy: "admin-1",
      reason: "spam", duration: 7, expiresAt: new Date("2026-08-08"),
    };
    expect(toPrismaData({ accountStatus: "suspended", activeSuspension: suspension }))
      .toEqual({ accountStatus: "suspended", activeSuspension: suspension });
  });

  test("an empty payload stays empty; input is never mutated", () => {
    expect(toPrismaData({})).toEqual({});
    expect(toPrismaData()).toEqual({});

    const input = { likesCount: { inc: 1 }, status: "x" };
    const snapshot = JSON.parse(JSON.stringify(input));
    toPrismaData(input);
    expect(input).toEqual(snapshot);
  });
});

describe("toPrismaData — unknown operators THROW (M-3's core guarantee)", () => {
  test("Prisma's own increment/decrement are REJECTED", () => {
    expect(() => toPrismaData({ likesCount: { increment: 1 } })).toThrow(/increment/);
    expect(() => toPrismaData({ likesCount: { decrement: 1 } })).toThrow(/decrement/);
  });

  test("Prisma's push/set/connect are REJECTED", () => {
    expect(() => toPrismaData({ snapshots: { push: {} } })).toThrow(/push/);
    expect(() => toPrismaData({ snapshots: { set: [] } })).toThrow(/set/);
    expect(() => toPrismaData({ groupAdmin: { connect: { id: "u" } } })).toThrow(/connect/);
  });

  test("unsupported Prisma write operators are REJECTED", () => {
    expect(() => toPrismaData({ n: { multiply: 2 } })).toThrow(/multiply/);
    expect(() => toPrismaData({ r: { disconnect: { id: "u" } } })).toThrow(/disconnect/);
  });

  test("the error names the field and offers the replacement", () => {
    expect(() => toPrismaData({ likesCount: { increment: 1 } }))
      .toThrow(/likesCount.*increment.*Use \{ inc: n \}/s);
  });

  test("a typo alongside a real operator throws", () => {
    expect(() => toPrismaData({ likesCount: { inc: 1, bogus: 2 } })).toThrow(/bogus/);
  });

  test("the whitelist is exported for the Mongo side to satisfy", () => {
    expect(NEUTRAL_MUTATIONS).toEqual(
      expect.arrayContaining(["inc", "dec", "append", "replace", "link"])
    );
  });
});

describe("toMongoUpdate — the mapping exists beside its Prisma counterpart", () => {
  // Not wired anywhere (Mongo implementations are still deferred), but
  // asserted so the two translations cannot drift apart unnoticed.
  test("inc/dec collapse into $inc, with dec negated", () => {
    expect(toMongoUpdate({ likesCount: { inc: 1 } })).toEqual({ $inc: { likesCount: 1 } });
    expect(toMongoUpdate({ likesCount: { dec: 3 } })).toEqual({ $inc: { likesCount: -3 } });
  });

  test("append → $push, replace → $set, link → foreign key assignment", () => {
    expect(toMongoUpdate({ snapshots: { append: { id: "s" } } }))
      .toEqual({ $push: { snapshots: { id: "s" } } });
    expect(toMongoUpdate({ snapshots: { replace: [] } })).toEqual({ $set: { snapshots: [] } });
    expect(toMongoUpdate({ groupAdmin: { link: "u1" } })).toEqual({ $set: { groupAdmin: "u1" } });
  });

  test("plain fields collect under $set", () => {
    expect(toMongoUpdate({ status: "active", isDeleted: true }))
      .toEqual({ $set: { status: "active", isDeleted: true } });
  });

  test("mixed payloads produce both operators", () => {
    expect(toMongoUpdate({ status: "x", likesCount: { inc: 1 } }))
      .toEqual({ $set: { status: "x" }, $inc: { likesCount: 1 } });
  });
});
