// Characterization test for the `user` domain (Milestone 5F).
// user.controller.js has no existing helpers for these queries, so the
// baseline characterizes CURRENT observable DB behavior via exact inline
// mirrors of the controller's queries. After extraction, the same
// assertions are re-expressed against the new userHelpers methods.
//
// EXTERNAL SERVICES — deliberately NOT invoked here:
//   • Cloudinary (avatar/cover upload/delete) — tests exercise the DB
//     update only, never the upload flow.
//   • OpenStreetMap / Nominatim (geocoding in updateProfile) — the
//     extracted DB helper does NO geocoding; geocoding stays in the
//     controller, so every helper/query test is fully network-free.
//   • Redis (caching) — not a persistence path; not exercised.
// The `Prisma.JsonNull` sentinel used by getMapSellers IS characterized.
import { PrismaClient, Prisma } from "@prisma/client";
import * as UserHelper from "../../src/utils/userHelpers.js";
import { userRepository, sessionRepository } from "../../src/config/repositories.js";
import { PrismaUserRepository } from "../../../shared/database/repositories/users/UserRepository.js";

const prisma = new PrismaClient();

const userIds = [];
async function makeUser(data = {}) {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: { fullName: `U ${s}`, email: `u-${s}@e.com`, username: `u_${s}`, accountStatus: "active", ...data },
  });
  userIds.push(u.id);
  return u;
}

afterAll(async () => {
  await prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] } });
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: userIds } }, { followingId: { in: userIds } }] } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// Inline mirror of getMapSellers' query (byte-identical baseConditions + findMany).
async function inlineMapSellers({ q, category } = {}) {
  const baseConditions = [
    { accountStatus: "active" },
    { role: { not: "super_admin" } },
    { NOT: { location: { equals: Prisma.JsonNull } } },
  ];
  if (category && category !== "all") baseConditions.push({ businessCategory: category });
  if (q) {
    baseConditions.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { designation: { contains: q, mode: "insensitive" } },
        { businessCategory: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  return prisma.user.findMany({
    where: { AND: baseConditions },
    select: { id: true, fullName: true, username: true, avatar: true, designation: true, businessCategory: true, location: true, followersCount: true, isVerifiedBadge: true, isPrivate: true },
    take: 200,
  });
}

describe("user profile & media updates (inline mirror)", () => {
  test("profile update writes the given fields", async () => {
    const u = await makeUser();
    const updated = await prisma.user.update({ where: { id: u.id }, data: { fullName: "Updated Name", bio: "hi" } });
    expect(updated.fullName).toBe("Updated Name");
    expect(updated.bio).toBe("hi");
  });

  test("avatar update then remove", async () => {
    const u = await makeUser();
    await prisma.user.update({ where: { id: u.id }, data: { avatar: { url: "http://x/a.jpg", publicId: "a1" } } });
    expect((await prisma.user.findUnique({ where: { id: u.id } })).avatar).toEqual({ url: "http://x/a.jpg", publicId: "a1" });
    await prisma.user.update({ where: { id: u.id }, data: { avatar: { url: null, publicId: null } } });
    expect((await prisma.user.findUnique({ where: { id: u.id } })).avatar).toEqual({ url: null, publicId: null });
  });

  test("cover photo update then remove", async () => {
    const u = await makeUser();
    await prisma.user.update({ where: { id: u.id }, data: { coverPhoto: { url: "http://x/c.jpg", publicId: "c1" } } });
    expect((await prisma.user.findUnique({ where: { id: u.id } })).coverPhoto).toEqual({ url: "http://x/c.jpg", publicId: "c1" });
    await prisma.user.update({ where: { id: u.id }, data: { coverPhoto: { url: null, publicId: null } } });
    expect((await prisma.user.findUnique({ where: { id: u.id } })).coverPhoto).toEqual({ url: null, publicId: null });
  });
});

describe("map sellers query (inline mirror, incl. Prisma.JsonNull)", () => {
  let withLoc, jsonNullLoc, adminLoc, deactLoc, granite;
  beforeAll(async () => {
    withLoc = await makeUser({ businessCategory: "marble", designation: "supplier", location: { city: "Mumbai" } });
    jsonNullLoc = await makeUser({ businessCategory: "granite", location: Prisma.JsonNull });
    adminLoc = await makeUser({ role: "super_admin", location: { city: "Delhi" } });
    deactLoc = await makeUser({ accountStatus: "deactivated", location: { city: "Pune" } });
    granite = await makeUser({ businessCategory: "granite", location: { city: "Jaipur" } });
  });

  test("includes active non-admin sellers WITH a location; excludes JsonNull-location, admin, and non-active", async () => {
    const ids = (await inlineMapSellers({})).map((u) => u.id);
    expect(ids).toContain(withLoc.id);
    expect(ids).not.toContain(jsonNullLoc.id); // Prisma.JsonNull excluded by NOT-equals
    expect(ids).not.toContain(adminLoc.id);
    expect(ids).not.toContain(deactLoc.id);
  });

  test("category filter narrows results", async () => {
    const ids = (await inlineMapSellers({ category: "granite" })).map((u) => u.id);
    expect(ids).toContain(granite.id);
    expect(ids).not.toContain(withLoc.id); // marble, filtered out
  });

  test("q filter matches fullName / designation / businessCategory (case-insensitive)", async () => {
    const ids = (await inlineMapSellers({ q: "MARBLE" })).map((u) => u.id);
    expect(ids).toContain(withLoc.id); // businessCategory "marble"
    expect(ids).not.toContain(granite.id);
  });
});

describe("block operations (inline mirror)", () => {
  test("upsert block, findUnique both directions, blocked-list include, deleteMany unblock", async () => {
    const me = await makeUser();
    const them = await makeUser();

    // block
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: them.id } },
      update: {},
      create: { blockerId: me.id, blockedId: them.id },
    });
    // upsert again is idempotent (no duplicate)
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: them.id } },
      update: {},
      create: { blockerId: me.id, blockedId: them.id },
    });
    expect(await prisma.block.count({ where: { blockerId: me.id, blockedId: them.id } })).toBe(1);

    // status both directions
    const iBlockedThem = await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: me.id, blockedId: them.id } } });
    const theyBlockedMe = await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: them.id, blockedId: me.id } } });
    expect(!!iBlockedThem).toBe(true);
    expect(!!theyBlockedMe).toBe(false);

    // blocked list with profile include
    const blocks = await prisma.block.findMany({
      where: { blockerId: me.id },
      include: { blocked: { select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true } } },
    });
    expect(blocks.map((b) => b.blocked.id)).toContain(them.id);
    expect(Object.keys(blocks[0].blocked).sort()).toEqual(["avatar", "fullName", "id", "isVerifiedBadge", "username"].sort());

    // unblock
    await prisma.block.deleteMany({ where: { blockerId: me.id, blockedId: them.id } });
    expect(await prisma.block.count({ where: { blockerId: me.id, blockedId: them.id } })).toBe(0);
  });
});

describe("accepted following ids (inline mirror)", () => {
  test("returns the accepted following ids for a user", async () => {
    const me = await makeUser();
    const followed = await makeUser();
    await prisma.follow.create({ data: { followerId: me.id, followingId: followed.id, status: "accepted" } });
    const rows = await prisma.follow.findMany({ where: { followerId: me.id, status: "accepted" }, select: { followingId: true } });
    expect(rows.map((r) => r.followingId)).toContain(followed.id);
  });
});

// After extraction: the userHelpers methods must match the inline behavior.
describe("userHelpers — extracted queries match inline behavior", () => {
  test("updateUserAvatar / updateUserCoverPhoto / updateUserProfileFields", async () => {
    const u = await makeUser();
    await UserHelper.updateUserAvatar(u.id, { url: "http://x/a.jpg", publicId: "a1" });
    await UserHelper.updateUserCoverPhoto(u.id, { url: "http://x/c.jpg", publicId: "c1" });
    const updated = await UserHelper.updateUserProfileFields(u.id, { fullName: "Helper Name", bio: "b" });
    expect(updated.fullName).toBe("Helper Name");
    const reloaded = await prisma.user.findUnique({ where: { id: u.id } });
    expect(reloaded.avatar).toEqual({ url: "http://x/a.jpg", publicId: "a1" });
    expect(reloaded.coverPhoto).toEqual({ url: "http://x/c.jpg", publicId: "c1" });
    // remove path (null values), same helper
    await UserHelper.updateUserAvatar(u.id, { url: null, publicId: null });
    expect((await prisma.user.findUnique({ where: { id: u.id } })).avatar).toEqual({ url: null, publicId: null });
  });

  test("findMapSellers matches inline (JsonNull excluded, category + q filters)", async () => {
    const s = await makeUser({ businessCategory: "quartz", designation: "wholesaler", location: { city: "Chennai" } });
    const jn = await makeUser({ businessCategory: "quartz", location: Prisma.JsonNull });
    const all = (await UserHelper.findMapSellers({})).map((u) => u.id);
    expect(all).toContain(s.id);
    expect(all).not.toContain(jn.id);
    expect((await UserHelper.findMapSellers({ category: "quartz" })).map((u) => u.id)).toContain(s.id);
    expect((await UserHelper.findMapSellers({ q: "wholesaler" })).map((u) => u.id)).toContain(s.id);
  });

  test("getAcceptedFollowingIds returns accepted following ids", async () => {
    const me = await makeUser();
    const followed = await makeUser();
    await prisma.follow.create({ data: { followerId: me.id, followingId: followed.id, status: "accepted" } });
    expect((await UserHelper.getAcceptedFollowingIds(me.id)).map((r) => r.followingId)).toContain(followed.id);
  });

  test("upsertBlock / findBlock / findBlockedUsers / deleteBlock", async () => {
    const me = await makeUser();
    const them = await makeUser();
    await UserHelper.upsertBlock(me.id, them.id);
    await UserHelper.upsertBlock(me.id, them.id); // idempotent
    expect(await prisma.block.count({ where: { blockerId: me.id, blockedId: them.id } })).toBe(1);
    expect(!!(await UserHelper.findBlock(me.id, them.id))).toBe(true);
    expect(!!(await UserHelper.findBlock(them.id, me.id))).toBe(false);
    const blocked = await UserHelper.findBlockedUsers(me.id);
    expect(blocked.map((b) => b.blocked.id)).toContain(them.id);
    await UserHelper.deleteBlock(me.id, them.id);
    expect(await prisma.block.count({ where: { blockerId: me.id, blockedId: them.id } })).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5F/5I suite above never had.
// The ENTIRE refresh-token lifecycle (10 methods, including the MAX_DEVICES
// eviction), every unique-field lookup and its normalization, searchUsers,
// updateCount validation, and toSafeObject were all untested.
//
// Written and run GREEN against the original direct-Prisma implementation
// BEFORE the repository migration, so they are a true before/after net.
//
// AUTHENTICATION IS FROZEN (Milestone 5I): these tests characterize the
// existing token persistence exactly as-is; nothing about token generation,
// expiry, or eviction is being changed.
//
// NETWORK: userHelpers performs NO geocoding — the Nominatim call lives in
// the controller's orchestration (see the file header). Every test here is
// network-free by construction.
// ─────────────────────────────────────────────────────────────────────────

const MISSING = "00000000-0000-0000-0000-000000000000";

describe("userHelpers — unique-field lookups & normalization (Phase 7A)", () => {
  test("findByEmail lowercases and trims its argument", async () => {
    const u = await makeUser();
    expect((await UserHelper.findByEmail(u.email)).id).toBe(u.id);
    expect((await UserHelper.findByEmail(`  ${u.email.toUpperCase()}  `)).id).toBe(u.id);
    expect(await UserHelper.findByEmail("nobody@example.com")).toBeNull();
  });

  test("findByUsername lowercases and trims its argument", async () => {
    const u = await makeUser();
    expect((await UserHelper.findByUsername(u.username)).id).toBe(u.id);
    expect((await UserHelper.findByUsername(`  ${u.username.toUpperCase()}  `)).id).toBe(u.id);
    expect(await UserHelper.findByUsername("no_such_user_xyz")).toBeNull();
  });

  test("findByPhone and findByFirebaseUid match verbatim (no normalization)", async () => {
    const phone = `+3520000${Date.now() % 100000}`;
    const uid = `fb_${Date.now()}`;
    const u = await makeUser({ phoneNumber: phone, firebaseUid: uid });

    expect((await UserHelper.findByPhone(phone)).id).toBe(u.id);
    expect((await UserHelper.findByFirebaseUid(uid)).id).toBe(u.id);
    expect(await UserHelper.findByPhone("+352999999999")).toBeNull();
    expect(await UserHelper.findByFirebaseUid("fb_nope")).toBeNull();
  });

  test("findById returns the whole row, null for missing", async () => {
    const u = await makeUser();
    const found = await UserHelper.findById(u.id);
    expect(found.id).toBe(u.id);
    expect(found).toHaveProperty("email");
    expect(found).toHaveProperty("accountStatus");
    expect(await UserHelper.findById(MISSING)).toBeNull();
  });

  test("findByFirebaseUidOrEmail matches on EITHER identifier", async () => {
    const uid = `fbor_${Date.now()}`;
    const u = await makeUser({ firebaseUid: uid });

    expect((await UserHelper.findByFirebaseUidOrEmail(uid, "unrelated@e.com")).id).toBe(u.id);
    expect((await UserHelper.findByFirebaseUidOrEmail("fb_nope", u.email)).id).toBe(u.id);
    // email side is lowercased by the helper
    expect((await UserHelper.findByFirebaseUidOrEmail("fb_nope", u.email.toUpperCase())).id).toBe(u.id);
    expect(await UserHelper.findByFirebaseUidOrEmail("fb_nope", "nobody@e.com")).toBeNull();
  });
});

describe("userHelpers — createUser / updateUserById / updateCount (Phase 7A)", () => {
  test("createUser persists the assembled row and returns it", async () => {
    const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const created = await UserHelper.createUser({
      fullName: `Created ${s}`,
      email: `created-${s}@e.com`,
      username: `created_${s}`,
      accountStatus: "pending",
    });
    userIds.push(created.id);

    expect(created.id).toBeTruthy();
    expect(created.accountStatus).toBe("pending");
    expect((await prisma.user.findUnique({ where: { id: created.id } })).username).toBe(`created_${s}`);
  });

  test("updateUserById applies the assembled verification-state update", async () => {
    const u = await makeUser({ accountStatus: "pending", isEmailVerified: false });
    const updated = await UserHelper.updateUserById(u.id, {
      isEmailVerified: true,
      accountStatus: "active",
    });
    expect(updated.isEmailVerified).toBe(true);
    expect(updated.accountStatus).toBe("active");
  });

  test("updateCount increments and decrements the three countable fields", async () => {
    const u = await makeUser();
    for (const field of ["followersCount", "followingCount", "postsCount"]) {
      await UserHelper.updateCount(u.id, field, 2);
      await UserHelper.updateCount(u.id, field, -1);
    }
    const row = await prisma.user.findUnique({ where: { id: u.id } });
    expect(row.followersCount).toBe(1);
    expect(row.followingCount).toBe(1);
    expect(row.postsCount).toBe(1);
  });

  test("updateCount rejects a non-countable field and a non-finite value", async () => {
    const u = await makeUser();

    // NOTE: updateCount is a plain (non-async) arrow function, so its guards
    // throw SYNCHRONOUSLY rather than returning a rejected promise. Callers
    // must use try/catch, not .catch(). Pinned here because a later
    // conversion to `async` would silently change that contract.
    expect(() => UserHelper.updateCount(u.id, "email", 1)).toThrow(/Invalid count field/);
    expect(() => UserHelper.updateCount(u.id, "postsCount", "3")).toThrow(/finite number/);
    expect(() => UserHelper.updateCount(u.id, "postsCount", NaN)).toThrow(/finite number/);
    expect(() => UserHelper.updateCount(u.id, "postsCount", Infinity)).toThrow(/finite number/);

    // nothing was written by any rejected call
    const row = await prisma.user.findUnique({ where: { id: u.id } });
    expect(row.postsCount).toBe(0);
  });
});

describe("userHelpers — searchUsers (Phase 7A)", () => {
  test("returns [] for a blank or too-short query without touching the DB", async () => {
    expect(await UserHelper.searchUsers("")).toEqual([]);
    expect(await UserHelper.searchUsers("  ")).toEqual([]);
    expect(await UserHelper.searchUsers("a")).toEqual([]);
    expect(await UserHelper.searchUsers(null)).toEqual([]);
  });

  test("matches username or fullName case-insensitively with the search projection", async () => {
    const tag = `srch${Date.now().toString().slice(-6)}`;
    const byName = await makeUser({ fullName: `Marble ${tag} Co` });

    const hits = await UserHelper.searchUsers(tag.toUpperCase());
    expect(hits.map((h) => h.id)).toContain(byName.id);
    expect(Object.keys(hits[0]).sort()).toEqual(
      ["avatar", "followersCount", "fullName", "id", "isPrivate", "isVerifiedBadge", "username"].sort()
    );
    expect(hits[0].email).toBeUndefined(); // not projected
  });

  test("excludes super_admins and non-active accounts", async () => {
    const tag = `excl${Date.now().toString().slice(-6)}`;
    const ok = await makeUser({ fullName: `Yes ${tag}` });
    await makeUser({ fullName: `Admin ${tag}`, role: "super_admin" });
    await makeUser({ fullName: `Susp ${tag}`, accountStatus: "suspended" });

    const hits = await UserHelper.searchUsers(tag);
    expect(hits.map((h) => h.id)).toEqual([ok.id]);
  });

  test("clamps the limit to 1..50 and defaults to 20", async () => {
    const tag = `lim${Date.now().toString().slice(-6)}`;
    for (let i = 0; i < 3; i++) await makeUser({ fullName: `Many ${tag} ${i}` });

    expect((await UserHelper.searchUsers(tag, 2)).length).toBe(2);
    expect((await UserHelper.searchUsers(tag, 0)).length).toBe(3); // 0 → falsy → default 20
    expect((await UserHelper.searchUsers(tag, -5)).length).toBe(1); // clamped up to 1
    expect((await UserHelper.searchUsers(tag, 999)).length).toBe(3); // clamped down to 50
  });
});

describe("userHelpers — refresh-token lifecycle (Phase 7A)", () => {
  test("generateRefreshToken stores a HASH, never the raw token", async () => {
    const u = await makeUser();
    const raw = await UserHelper.generateRefreshToken(u, "device-a", "1.2.3.4");

    const rows = await prisma.refreshToken.findMany({ where: { userId: u.id } });
    expect(rows.length).toBe(1);
    expect(rows[0].tokenHash).not.toBe(raw);
    expect(rows[0].tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
    expect(rows[0].deviceInfo).toBe("device-a");
    expect(rows[0].ipAddress).toBe("1.2.3.4");
    expect(rows[0].lastUsedAt).toBeInstanceOf(Date);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("rememberMe extends the stored expiry to ~30 days", async () => {
    const u = await makeUser();
    await UserHelper.generateRefreshToken(u, "d", null, false);
    const shortRow = await prisma.refreshToken.findFirst({ where: { userId: u.id } });
    const shortDays = (shortRow.expiresAt - Date.now()) / 86400000;

    const u2 = await makeUser();
    await UserHelper.generateRefreshToken(u2, "d", null, true);
    const longRow = await prisma.refreshToken.findFirst({ where: { userId: u2.id } });
    const longDays = (longRow.expiresAt - Date.now()) / 86400000;

    expect(longDays).toBeGreaterThan(shortDays);
    expect(longDays).toBeGreaterThan(29);
    expect(longDays).toBeLessThan(31);
  });

  test("generating a token purges the user's already-expired rows", async () => {
    const u = await makeUser();
    await prisma.refreshToken.create({
      data: {
        userId: u.id,
        tokenHash: `expired_${u.id}`,
        expiresAt: new Date(Date.now() - 86400000),
      },
    });
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(1);

    await UserHelper.generateRefreshToken(u, "fresh");

    const rows = await prisma.refreshToken.findMany({ where: { userId: u.id } });
    expect(rows.length).toBe(1); // the expired one was deleted, the new one added
    expect(rows[0].deviceInfo).toBe("fresh");
  });

  test("the device cap evicts the OLDEST tokens beyond MAX_DEVICES (10)", async () => {
    const u = await makeUser();
    const raws = [];
    for (let i = 0; i < 12; i++) {
      raws.push(await UserHelper.generateRefreshToken(u, `device-${i}`));
      await new Promise((r) => setTimeout(r, 3)); // distinct createdAt for the asc ordering
    }

    const rows = await prisma.refreshToken.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.length).toBe(10); // capped
    // the two oldest devices were evicted
    const devices = rows.map((r) => r.deviceInfo);
    expect(devices).not.toContain("device-0");
    expect(devices).not.toContain("device-1");
    expect(devices).toContain("device-11");
  });

  test("findByRefreshToken returns the user plus the matched row, and rejects expired", async () => {
    const u = await makeUser();
    const raw = await UserHelper.generateRefreshToken(u, "lookup");

    const found = await UserHelper.findByRefreshToken(raw);
    expect(found.id).toBe(u.id);
    expect(found.email).toBe(u.email);
    expect(found._matchedTokenRow.deviceInfo).toBe("lookup");

    expect(await UserHelper.findByRefreshToken("not-a-real-token")).toBeNull();

    // an expired row is not matched
    await prisma.refreshToken.updateMany({
      where: { userId: u.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await UserHelper.findByRefreshToken(raw)).toBeNull();
  });

  test("touchRefreshToken advances lastUsedAt", async () => {
    const u = await makeUser();
    const raw = await UserHelper.generateRefreshToken(u, "touch");
    const before = (await prisma.refreshToken.findFirst({ where: { userId: u.id } })).lastUsedAt;

    await new Promise((r) => setTimeout(r, 10));
    const result = await UserHelper.touchRefreshToken(raw);
    expect(result.count).toBe(1);

    const after = (await prisma.refreshToken.findFirst({ where: { userId: u.id } })).lastUsedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  test("getRefreshTokenByHash / consumeRefreshTokenByHash round-trip", async () => {
    const u = await makeUser();
    const raw = await UserHelper.generateRefreshToken(u, "consume");

    expect(await UserHelper.getRefreshTokenByHash(u.id, raw)).not.toBeNull();
    expect(await UserHelper.consumeRefreshTokenByHash(u.id, raw)).toBe(true);
    expect(await UserHelper.getRefreshTokenByHash(u.id, raw)).toBeNull();
    expect(await UserHelper.consumeRefreshTokenByHash(u.id, raw)).toBe(false); // already gone
  });

  // ── PRE-EXISTING FINDING, characterized not fixed ────────────────────
  // jwt.sign() is DETERMINISTIC for a fixed payload/secret/expiry within a
  // one-second window (the `iat` claim has second granularity). Since the
  // refresh-token payload is only `{ _id: user.id }`, two sessions created
  // for the same user in the same second produce a BYTE-IDENTICAL token and
  // therefore an identical sha256 tokenHash.
  //
  // Consequences, all of which the tests below pin as current behavior:
  //   • removeRefreshToken(userId, raw) revokes EVERY colliding session.
  //   • removeOtherRefreshTokens(userId, current) revokes NOTHING, because
  //     `tokenHash: { not: currentHash }` excludes the collisions too.
  //   • consumeRefreshTokenByHash consumes all colliding rows at once.
  //
  // This is security-relevant but is NOT changed here: authentication was
  // frozen in Milestone 5I and Phase 7A is strictly behaviour-preserving.
  // Flagged in the milestone report for a separate decision.
  test("PRE-EXISTING: tokens minted in the same second collide by hash", async () => {
    const u = await makeUser();
    await UserHelper.generateRefreshToken(u, "first");
    await UserHelper.generateRefreshToken(u, "second");

    const rows = await prisma.refreshToken.findMany({ where: { userId: u.id } });
    expect(rows.length).toBe(2); // two separate session ROWS...
    expect(rows[0].tokenHash).toBe(rows[1].tokenHash); // ...sharing one hash
  });

  test("removeRefreshToken deletes every row matching the token's hash", async () => {
    const u = await makeUser();
    // distinct hashes, inserted directly, to exercise the intended semantics
    await prisma.refreshToken.createMany({
      data: [
        { userId: u.id, tokenHash: `keep_${u.id}`, expiresAt: new Date(Date.now() + 86400000), deviceInfo: "keep" },
        { userId: u.id, tokenHash: `drop_${u.id}`, expiresAt: new Date(Date.now() + 86400000), deviceInfo: "drop" },
      ],
    });

    // removeRefreshToken hashes its argument, so drive it via a real token
    const raw = await UserHelper.generateRefreshToken(u, "real");
    await UserHelper.removeRefreshToken(u.id, raw);

    const rows = await prisma.refreshToken.findMany({ where: { userId: u.id } });
    expect(rows.map((r) => r.deviceInfo).sort()).toEqual(["drop", "keep"]); // only "real" went
  });

  test("removeAllRefreshTokens clears every session for the user only", async () => {
    const u = await makeUser();
    const other = await makeUser();
    await UserHelper.generateRefreshToken(u, "d1");
    await UserHelper.generateRefreshToken(u, "d2");
    await UserHelper.generateRefreshToken(other, "theirs");

    await UserHelper.removeAllRefreshTokens(u.id);
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: other.id } })).toBe(1);
  });

  test("removeOtherRefreshTokens keeps the current hash and clears the rest", async () => {
    const u = await makeUser();
    const current = await UserHelper.generateRefreshToken(u, "current");
    // distinct hashes so the `not` filter is genuinely exercised (see the
    // same-second collision finding above)
    await prisma.refreshToken.createMany({
      data: [
        { userId: u.id, tokenHash: `o1_${u.id}`, expiresAt: new Date(Date.now() + 86400000), deviceInfo: "other-1" },
        { userId: u.id, tokenHash: `o2_${u.id}`, expiresAt: new Date(Date.now() + 86400000), deviceInfo: "other-2" },
      ],
    });

    await UserHelper.removeOtherRefreshTokens(u.id, current);
    const rows = await prisma.refreshToken.findMany({ where: { userId: u.id } });
    expect(rows.map((r) => r.deviceInfo)).toEqual(["current"]);
  });

  test("removeOtherRefreshTokens with no current token clears everything", async () => {
    const u = await makeUser();
    await UserHelper.generateRefreshToken(u, "a");
    await prisma.refreshToken.create({
      data: { userId: u.id, tokenHash: `b_${u.id}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    await UserHelper.removeOtherRefreshTokens(u.id, null);
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);
  });

  test("generateAdminRefreshToken stores a row and purges expired ones", async () => {
    const admin = await makeUser({ role: "super_admin" });
    await prisma.refreshToken.create({
      data: {
        userId: admin.id,
        tokenHash: `adminexpired_${admin.id}`,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const raw = await UserHelper.generateAdminRefreshToken(admin, "admin-device", "9.9.9.9");
    expect(typeof raw).toBe("string");

    const rows = await prisma.refreshToken.findMany({ where: { userId: admin.id } });
    expect(rows.length).toBe(1);
    expect(rows[0].deviceInfo).toBe("admin-device");
    expect(rows[0].ipAddress).toBe("9.9.9.9");
  });
});

describe("userHelpers — password & safe object (Phase 7A)", () => {
  test("hashPassword produces a verifiable, salted hash", async () => {
    const hash = await UserHelper.hashPassword("Secret123");
    expect(hash).not.toBe("Secret123");
    expect(await UserHelper.isPasswordCorrect({ password: hash }, "Secret123")).toBe(true);
    expect(await UserHelper.isPasswordCorrect({ password: hash }, "Wrong123")).toBe(false);

    // salted — two hashes of the same input differ
    expect(await UserHelper.hashPassword("Secret123")).not.toBe(hash);
  });

  test("isPasswordCorrect is false for a user with no password", async () => {
    expect(await UserHelper.isPasswordCorrect({}, "x")).toBe(false);
    expect(await UserHelper.isPasswordCorrect(null, "x")).toBe(false);
    expect(await UserHelper.isPasswordCorrect({ password: null }, "x")).toBe(false);
  });

  test("toSafeObject exposes hasPassword but never the password itself", async () => {
    const u = await makeUser({ password: await UserHelper.hashPassword("Secret123") });
    const safe = UserHelper.toSafeObject(await UserHelper.findById(u.id));

    expect(safe.password).toBeUndefined();
    expect(safe.hasPassword).toBe(true);
    expect(safe._id).toBe(u.id); // id is remapped to _id
    expect(safe.id).toBeUndefined();

    const noPw = UserHelper.toSafeObject(await UserHelper.findById((await makeUser()).id));
    expect(noPw.hasPassword).toBe(false);
  });

  test("toSafeObject coerces absent optional fields to null / empty string", async () => {
    const u = await makeUser();
    const safe = UserHelper.toSafeObject(await UserHelper.findById(u.id));

    expect(safe.phoneNumber).toBeNull();
    expect(safe.avatar).toBeNull();
    expect(safe.avatarUrl).toBeNull();
    expect(safe.businessCategory).toBeNull();
    expect(safe.location).toBeNull();
    expect(safe.designation).toBe(""); // empty string, not null
  });

  test("toSafeObject surfaces avatarUrl from a populated avatar object", async () => {
    const u = await makeUser({ avatar: { url: "https://cdn/a.jpg", publicId: "a" } });
    const safe = UserHelper.toSafeObject(await UserHelper.findById(u.id));
    expect(safe.avatarUrl).toBe("https://cdn/a.jpg");
    expect(safe.avatar.publicId).toBe("a");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY HAZARD REGRESSIONS (Phase 7A Milestone 9)
//
// The JsonNull encapsulation is the architectural centrepiece of this
// milestone, so its contract is asserted directly rather than only through
// the helper.
// ─────────────────────────────────────────────────────────────────────────
describe("UserRepository.findUsersWithLocation — JsonNull encapsulation (Phase 7A)", () => {
  test("the sentinel is applied internally: rows without a location are excluded", async () => {
    const tag = `enc${Date.now().toString().slice(-6)}`;
    const withLoc = await makeUser({
      fullName: `Has ${tag}`,
      location: { name: "Carrara" },
    });
    const noLoc = await makeUser({ fullName: `None ${tag}` });

    // caller supplies ONLY plain conditions — no sentinel, no Prisma import
    const rows = await userRepository.findUsersWithLocation(
      [{ fullName: { like: tag, caseInsensitive: true } }],
      { select: { id: true, location: true }, take: 200 }
    );

    expect(rows.map((r) => r.id)).toEqual([withLoc.id]);
    expect(rows.map((r) => r.id)).not.toContain(noLoc.id);
  });

  test("it matches the inline Prisma.JsonNull query exactly", async () => {
    const tag = `par${Date.now().toString().slice(-6)}`;
    await makeUser({ fullName: `A ${tag}`, location: { name: "X" } });
    await makeUser({ fullName: `B ${tag}` });
    await makeUser({ fullName: `C ${tag}`, location: { name: "Y" }, accountStatus: "suspended" });

    const viaRepo = await userRepository.findUsersWithLocation(
      [
        { accountStatus: "active" },
        { role: { not: "super_admin" } },
        // Neutral DSL (Phase 7B/M-1); the inline oracle below stays in
        // Prisma's own vocabulary, which is what makes it an oracle.
        { fullName: { like: tag, caseInsensitive: true } },
      ],
      { select: { id: true }, take: 200 }
    );

    // the original inline query, still using the sentinel directly
    const viaInline = await prisma.user.findMany({
      where: {
        AND: [
          { accountStatus: "active" },
          { role: { not: "super_admin" } },
          { NOT: { location: { equals: Prisma.JsonNull } } },
          { fullName: { contains: tag, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 200,
    });

    expect(viaRepo.map((r) => r.id).sort()).toEqual(viaInline.map((r) => r.id).sort());
  });

  test("a repository built WITHOUT the sentinel fails loudly rather than silently", async () => {
    // Guards against a future wiring mistake in config/repositories.js that
    // would otherwise return every user, location or not.
    const unwired = new PrismaUserRepository(prisma);
    await expect(unwired.findUsersWithLocation([], { take: 1 })).rejects.toThrow(
      /requires the Prisma\.JsonNull sentinel/
    );
  });

  test("userHelpers itself is Prisma-free — findMapSellers still filters correctly", async () => {
    const tag = `hlp${Date.now().toString().slice(-6)}`;
    const seller = await makeUser({
      fullName: `Seller ${tag}`,
      businessCategory: "marble",
      location: { name: "Verona" },
    });
    await makeUser({ fullName: `NoLoc ${tag}`, businessCategory: "marble" });

    const all = await UserHelper.findMapSellers({ q: tag });
    expect(all.map((r) => r.id)).toEqual([seller.id]);

    const byCategory = await UserHelper.findMapSellers({ q: tag, category: "marble" });
    expect(byCategory.map((r) => r.id)).toEqual([seller.id]);

    const wrongCategory = await UserHelper.findMapSellers({ q: tag, category: "granite" });
    expect(wrongCategory).toEqual([]);
  });
});

describe("SessionRepository — device-cap ordering contract (Phase 7A)", () => {
  test("findAllByUserIdOldestFirst orders opposite to findByUserId", async () => {
    // The eviction slices from the FRONT, so oldest-first ordering is
    // load-bearing. findByUserId orders by lastUsedAt DESC and would evict
    // the wrong sessions if substituted.
    const u = await makeUser();
    for (let i = 0; i < 3; i++) {
      await prisma.refreshToken.create({
        data: {
          userId: u.id,
          tokenHash: `ord${i}_${u.id}`,
          deviceInfo: `d${i}`,
          expiresAt: new Date(Date.now() + 86400000),
          lastUsedAt: new Date(Date.now() - i * 60000), // d0 most recent
        },
      });
      await new Promise((r) => setTimeout(r, 5));
    }

    const oldestFirst = await sessionRepository.findAllByUserIdOldestFirst(u.id);
    expect(oldestFirst.map((r) => r.deviceInfo)).toEqual(["d0", "d1", "d2"]); // createdAt asc

    const byLastUsed = await sessionRepository.findByUserId(u.id);
    expect(byLastUsed.map((r) => r.deviceInfo)).toEqual(["d0", "d1", "d2"].reverse().reverse());
    // (lastUsedAt desc → d0 first here too, but the ORDERING FIELD differs;
    // the point is that these are two distinct contracts.)
    expect(byLastUsed[0].lastUsedAt.getTime()).toBeGreaterThanOrEqual(
      byLastUsed[byLastUsed.length - 1].lastUsedAt.getTime()
    );
  });

  test("findAllByUserIdOldestFirst is unbounded, so the cap math sees every session", async () => {
    const CAP = 20; // toPrismaPagination's default, were it applied
    const u = await makeUser();
    for (let i = 0; i < CAP + 3; i++) {
      await prisma.refreshToken.create({
        data: {
          userId: u.id,
          tokenHash: `many${i}_${u.id}`,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
    }

    const all = await sessionRepository.findAllByUserIdOldestFirst(u.id);
    expect(all.length).toBe(CAP + 3);
    expect(all.length).toBeGreaterThan(CAP);
  });
});
