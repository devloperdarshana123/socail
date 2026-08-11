// Characterization test for the `setting` domain (Milestone 5C — standalone).
// This controller touches password verification, account deletion, and
// token reissue, so its behavior is locked down against a real Postgres
// BEFORE the 3 direct Prisma lookups are extracted into settingsHelpers.js.
// Written against the helper layer's public contract.
import { PrismaClient } from "@prisma/client";
import * as SettingsHelper from "../../src/utils/settingsHelpers.js";
import * as UserHelper from "../../src/utils/userHelpers.js";
import {
  userRepository,
  socialPostRepository,
  storyRepository,
  sessionRepository,
} from "../../src/config/repositories.js";
import { transactionRunner } from "../../src/config/transaction.js";
import { NotFoundError } from "../../../shared/database/repositories/errors/index.js";

const prisma = new PrismaClient();

const createdUserIds = [];

async function makeUser({ password, accountStatus = "active", deactivatedAt = null } = {}) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const data = {
    fullName: `Setting Test ${stamp}`,
    email: `setting-${stamp}@example.com`,
    username: `setting_${stamp}`,
    accountStatus,
    deactivatedAt,
  };
  if (password) data.password = await UserHelper.hashPassword(password);
  const user = await prisma.user.create({ data });
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("settingsHelpers — profile, password, lifecycle (characterization)", () => {
  test("getUserProfile returns the selected profile shape, null for missing", async () => {
    const u = await makeUser();
    const profile = await SettingsHelper.getUserProfile(u.id);
    expect(profile.id).toBe(u.id);
    expect(profile).toHaveProperty("username");
    expect(profile).toHaveProperty("accountStatus");
    expect(profile).not.toHaveProperty("password"); // password is never selected
    const missing = await SettingsHelper.getUserProfile("00000000-0000-0000-0000-000000000000");
    expect(missing).toBeNull();
  });

  test("updatePassword rejects an incorrect current password", async () => {
    const u = await makeUser({ password: "OldPass123" });
    await expect(
      SettingsHelper.updatePassword(u.id, "WrongPass123", "NewPass456")
    ).rejects.toThrow(/incorrect/i);
  });

  test("updatePassword changes the password when the current one is correct", async () => {
    const u = await makeUser({ password: "OldPass123" });
    const result = await SettingsHelper.updatePassword(u.id, "OldPass123", "NewPass456");
    expect(result.message).toMatch(/updated successfully/i);
    const reloaded = await prisma.user.findUnique({ where: { id: u.id }, select: { password: true } });
    expect(await UserHelper.isPasswordCorrect(reloaded, "NewPass456")).toBe(true);
    expect(await UserHelper.isPasswordCorrect(reloaded, "OldPass123")).toBe(false);
  });

  test("deactivateAccount sets status, hides posts/stories, and clears sessions", async () => {
    const u = await makeUser({ password: "OldPass123" });
    const post = await prisma.post.create({ data: { type: "image", authorId: u.id } });
    const story = await prisma.story.create({
      data: { authorId: u.id, expiresAt: new Date(Date.now() + 86400000) },
    });
    await prisma.refreshToken.create({
      data: { userId: u.id, tokenHash: `hash_${u.id}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    await SettingsHelper.deactivateAccount(u.id);

    const reloaded = await prisma.user.findUnique({
      where: { id: u.id },
      select: { accountStatus: true, deactivatedAt: true },
    });
    expect(reloaded.accountStatus).toBe("deactivated");
    expect(reloaded.deactivatedAt).not.toBeNull();
    expect((await prisma.post.findUnique({ where: { id: post.id } })).isDeleted).toBe(true);
    expect((await prisma.story.findUnique({ where: { id: story.id } })).isDeleted).toBe(true);
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);
  });

  test("reactivateAccount restores a deactivated account and un-hides posts", async () => {
    const u = await makeUser({ password: "OldPass123" });
    const post = await prisma.post.create({ data: { type: "image", authorId: u.id } });
    await SettingsHelper.deactivateAccount(u.id);

    await SettingsHelper.reactivateAccount(u.id);

    const reloaded = await prisma.user.findUnique({ where: { id: u.id }, select: { accountStatus: true } });
    expect(reloaded.accountStatus).toBe("active");
    expect((await prisma.post.findUnique({ where: { id: post.id } })).isDeleted).toBe(false);
  });

  test("reactivateAccount throws when the account is not deactivated", async () => {
    const u = await makeUser();
    await expect(SettingsHelper.reactivateAccount(u.id)).rejects.toThrow(/not deactivated/i);
  });

  test("reactivateAccount throws when the 30-day window has expired", async () => {
    const u = await makeUser({
      accountStatus: "deactivated",
      deactivatedAt: new Date(Date.now() - 31 * 86400000),
    });
    await expect(SettingsHelper.reactivateAccount(u.id)).rejects.toThrow(/expired/i);
  });

  test("hardDeleteAccount removes the user row", async () => {
    const u = await makeUser({ password: "OldPass123" });
    await SettingsHelper.hardDeleteAccount(u.id);
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
  });

  // Lookup helpers extracted from setting.controller.js in Milestone 5.
  // Each must return exactly the selected shape the controller reads.
  test("getPasswordForVerification returns { password }, null for missing", async () => {
    const u = await makeUser({ password: "OldPass123" });
    const result = await SettingsHelper.getPasswordForVerification(u.id);
    expect(Object.keys(result)).toEqual(["password"]);
    expect(typeof result.password).toBe("string");
    expect(await SettingsHelper.getPasswordForVerification("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getUserForReactivation returns the 5 selected fields, null for missing", async () => {
    const u = await makeUser({ password: "OldPass123", accountStatus: "deactivated" });
    const result = await SettingsHelper.getUserForReactivation(u.id);
    expect(Object.keys(result).sort()).toEqual(
      ["accountStatus", "id", "isOnboardingComplete", "onboardingStep", "password"].sort()
    );
    expect(await SettingsHelper.getUserForReactivation("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getFullUserById returns the full user row, null for missing", async () => {
    const u = await makeUser();
    const result = await SettingsHelper.getFullUserById(u.id);
    expect(result.id).toBe(u.id);
    expect(result).toHaveProperty("email");
    expect(result).toHaveProperty("accountStatus");
    expect(await SettingsHelper.getFullUserById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5C suite above never had.
// updateUserProfile was entirely untested (including its validation rules
// and its Nominatim geocoding branch), as were updatePassword's Google and
// validation branches, both transactions' rollback behavior, and the
// account-lifecycle anonymization fields.
//
// Written and run GREEN against the original direct-Prisma implementation
// BEFORE the repository migration, so they are a true before/after net.
//
// NETWORK ISOLATION: updateUserProfile calls fetch() against
// nominatim.openstreetmap.org when a location carries city/state/country.
// global.fetch is stubbed in every test that reaches that branch — no test
// here touches the network.
// ─────────────────────────────────────────────────────────────────────────

const MISSING = "00000000-0000-0000-0000-000000000000";

describe("settingsHelpers — updateUserProfile validation & partial updates (Phase 7A)", () => {
  test("rejects a full name shorter than 2 or longer than 50 characters", async () => {
    const u = await makeUser();
    await expect(SettingsHelper.updateUserProfile(u.id, { fullName: "a" })).rejects.toThrow(
      /between 2 and 50/i
    );
    await expect(
      SettingsHelper.updateUserProfile(u.id, { fullName: "x".repeat(51) })
    ).rejects.toThrow(/between 2 and 50/i);

    // nothing was persisted by the rejected calls
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { fullName: true } });
    expect(row.fullName).toBe(u.fullName);
  });

  test("validates the TRIMMED length but persists the trimmed value", async () => {
    const u = await makeUser();
    // "  ab  " trims to 2 chars — valid
    const updated = await SettingsHelper.updateUserProfile(u.id, { fullName: "  ab  " });
    expect(updated.fullName).toBe("ab");

    // a whitespace-padded 1-char name still fails on the trimmed length
    await expect(SettingsHelper.updateUserProfile(u.id, { fullName: "   z   " })).rejects.toThrow(
      /between 2 and 50/i
    );
  });

  test("rejects a bio longer than 300 characters", async () => {
    const u = await makeUser();
    await expect(
      SettingsHelper.updateUserProfile(u.id, { bio: "x".repeat(301) })
    ).rejects.toThrow(/300 characters/i);

    // exactly 300 is allowed, and is NOT trimmed
    const ok = await SettingsHelper.updateUserProfile(u.id, { bio: " " + "y".repeat(299) });
    expect(ok.bio.length).toBe(300);
    expect(ok.bio.startsWith(" ")).toBe(true);
  });

  test("only supplied fields are written — undefined keys are left untouched", async () => {
    const u = await makeUser();
    await SettingsHelper.updateUserProfile(u.id, { bio: "first bio", designation: "Engineer" });

    const updated = await SettingsHelper.updateUserProfile(u.id, { designation: "Architect" });
    expect(updated.bio).toBe("first bio"); // untouched
    expect(updated.designation).toBe("Architect");
  });

  test("an empty update object is a no-op that still returns the user", async () => {
    const u = await makeUser();
    const result = await SettingsHelper.updateUserProfile(u.id, {});
    expect(result.id).toBe(u.id);
    expect(result.fullName).toBe(u.fullName);
  });

  test("falsy optional fields coerce to null rather than being skipped", async () => {
    const u = await makeUser();
    await SettingsHelper.updateUserProfile(u.id, {
      gender: "male",
      website: "https://x.com",
      businessCategory: "marble",
      dateOfBirth: new Date("1990-01-01"),
    });

    const cleared = await SettingsHelper.updateUserProfile(u.id, {
      gender: "",
      website: "",
      businessCategory: "",
      dateOfBirth: "",
    });

    expect(cleared.gender).toBeNull();
    expect(cleared.website).toBeNull();
    expect(cleared.businessCategory).toBeNull();
    expect(cleared.dateOfBirth).toBeNull();
  });

  test("designation is written verbatim, without the null-coercion the others get", async () => {
    // PRESERVED ODDITY: designation is assigned directly, so an empty string
    // stays an empty string rather than becoming null like gender/website do.
    const u = await makeUser();
    const updated = await SettingsHelper.updateUserProfile(u.id, { designation: "" });
    expect(updated.designation).toBe("");
    expect(updated.designation).not.toBeNull();
  });
});

describe("settingsHelpers — updateUserProfile location & geocoding (Phase 7A)", () => {
  const realFetch = global.fetch;

  // Hand-rolled stub — this suite runs under Jest's ESM mode, where the
  // `jest` object is not a global, so jest.fn() is unavailable without
  // importing @jest/globals. A recording stub keeps the test dependency-free.
  function stubFetch(impl) {
    const calls = [];
    const fn = async (...args) => {
      calls.push(args);
      return impl(...args);
    };
    fn.calls = calls;
    global.fetch = fn;
    return fn;
  }

  afterEach(() => {
    global.fetch = realFetch;
  });

  test("a null location clears the field without any network call", async () => {
    const u = await makeUser();
    const fetchStub = stubFetch(() => {
      throw new Error("fetch must not be called");
    });

    const updated = await SettingsHelper.updateUserProfile(u.id, { location: null });
    expect(updated.location).toBeNull();
    expect(fetchStub.calls.length).toBe(0);
  });

  test("a location without city/state/country is saved as-is, with no geocoding", async () => {
    const u = await makeUser();
    const fetchStub = stubFetch(() => {
      throw new Error("fetch must not be called");
    });

    const updated = await SettingsHelper.updateUserProfile(u.id, {
      location: { address: "Somewhere lane" },
    });
    expect(updated.location).toEqual({ address: "Somewhere lane" });
    expect(fetchStub.calls.length).toBe(0);
  });

  test("a geocodable location gains GeoJSON Point coordinates", async () => {
    const u = await makeUser();
    const fetchStub = stubFetch(async () => ({
      json: async () => [{ lon: "6.1319", lat: "49.6116" }],
    }));

    const updated = await SettingsHelper.updateUserProfile(u.id, {
      location: { city: "Luxembourg", country: "Luxembourg" },
    });

    expect(fetchStub.calls.length).toBe(1);
    const [url, opts] = fetchStub.calls[0];
    expect(url).toContain("nominatim.openstreetmap.org");
    expect(url).toContain(encodeURIComponent("Luxembourg, Luxembourg")); // city, country joined
    expect(opts.headers["User-Agent"]).toBe("Erovians/1.0");

    expect(updated.location).toEqual({
      city: "Luxembourg",
      country: "Luxembourg",
      coordinates: { type: "Point", coordinates: [6.1319, 49.6116] }, // lon, lat — parsed to numbers
    });
  });

  test("a geocoding failure still saves the location, without coordinates", async () => {
    const u = await makeUser();
    stubFetch(async () => {
      throw new Error("network down");
    });

    const updated = await SettingsHelper.updateUserProfile(u.id, {
      location: { city: "Nowhere" },
    });

    expect(updated.location).toEqual({ city: "Nowhere" });
    expect(updated.location.coordinates).toBeUndefined();
  });

  test("an empty geocoding result leaves the location without coordinates", async () => {
    const u = await makeUser();
    stubFetch(async () => ({ json: async () => [] }));

    const updated = await SettingsHelper.updateUserProfile(u.id, {
      location: { state: "Unknown State" },
    });

    expect(updated.location).toEqual({ state: "Unknown State" });
  });
});

describe("settingsHelpers — updatePassword branches (Phase 7A)", () => {
  test("rejects a new password shorter than 8 characters before touching the DB", async () => {
    const u = await makeUser({ password: "OldPass123" });
    await expect(SettingsHelper.updatePassword(u.id, "OldPass123", "short")).rejects.toThrow(
      /at least 8 characters/i
    );

    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { password: true } });
    expect(await UserHelper.isPasswordCorrect(row, "OldPass123")).toBe(true); // unchanged
  });

  test("throws for a missing user", async () => {
    await expect(SettingsHelper.updatePassword(MISSING, "OldPass123", "NewPass456")).rejects.toThrow(
      /User not found/i
    );
  });

  test("requires the current password for a normal user", async () => {
    const u = await makeUser({ password: "OldPass123" });
    await expect(SettingsHelper.updatePassword(u.id, null, "NewPass456")).rejects.toThrow(
      /Current password is required/i
    );
  });

  test("rejects reusing the same password", async () => {
    const u = await makeUser({ password: "SamePass123" });
    await expect(
      SettingsHelper.updatePassword(u.id, "SamePass123", "SamePass123")
    ).rejects.toThrow(/different from old password/i);
  });

  test("a Google user with no password can SET one without verification", async () => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const u = await prisma.user.create({
      data: {
        fullName: `Google User ${stamp}`,
        email: `setting-google-${stamp}@example.com`,
        username: `settinggoogle_${stamp}`,
        accountStatus: "active",
        authProvider: "google",
      },
    });
    createdUserIds.push(u.id);

    const result = await SettingsHelper.updatePassword(u.id, null, "BrandNew123");
    expect(result.message).toMatch(/created successfully/i);

    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { password: true } });
    expect(await UserHelper.isPasswordCorrect(row, "BrandNew123")).toBe(true);
  });

  test("the Google set-password path does NOT clear sessions, but a normal change does", async () => {
    // PRESERVED BEHAVIOR: only the verified-change path deletes refresh
    // tokens. Setting a first password for a Google account leaves sessions
    // intact — the deleteMany sits after the early return.
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const google = await prisma.user.create({
      data: {
        fullName: `Google Sess ${stamp}`,
        email: `setting-gsess-${stamp}@example.com`,
        username: `settinggsess_${stamp}`,
        accountStatus: "active",
        authProvider: "google",
      },
    });
    createdUserIds.push(google.id);
    await prisma.refreshToken.create({
      data: { userId: google.id, tokenHash: `gh_${google.id}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    await SettingsHelper.updatePassword(google.id, null, "GoogleSet123");
    expect(await prisma.refreshToken.count({ where: { userId: google.id } })).toBe(1); // kept

    const normal = await makeUser({ password: "OldPass123" });
    await prisma.refreshToken.create({
      data: { userId: normal.id, tokenHash: `nh_${normal.id}`, expiresAt: new Date(Date.now() + 86400000) },
    });
    await SettingsHelper.updatePassword(normal.id, "OldPass123", "NewPass456");
    expect(await prisma.refreshToken.count({ where: { userId: normal.id } })).toBe(0); // cleared
  });

  test("a Google user who already HAS a password goes through normal verification", async () => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const u = await prisma.user.create({
      data: {
        fullName: `Google WithPw ${stamp}`,
        email: `setting-gpw-${stamp}@example.com`,
        username: `settinggpw_${stamp}`,
        accountStatus: "active",
        authProvider: "google",
        password: await UserHelper.hashPassword("ExistingPw123"),
      },
    });
    createdUserIds.push(u.id);

    await expect(SettingsHelper.updatePassword(u.id, "WrongPw123", "NewPass456")).rejects.toThrow(
      /incorrect/i
    );
    const result = await SettingsHelper.updatePassword(u.id, "ExistingPw123", "NewPass456");
    expect(result.message).toMatch(/updated successfully/i);
  });
});

describe("settingsHelpers — account lifecycle details (Phase 7A)", () => {
  test("deactivateAccount anonymizes bio, designation and avatar", async () => {
    const u = await makeUser({ password: "OldPass123" });
    await SettingsHelper.updateUserProfile(u.id, { bio: "about me", designation: "CEO" });
    await prisma.user.update({
      where: { id: u.id },
      data: { avatar: { url: "https://cdn/a.jpg", publicId: "a" } },
    });

    await SettingsHelper.deactivateAccount(u.id);

    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { bio: true, designation: true, avatar: true, accountStatus: true },
    });
    expect(row.bio).toBe("");
    expect(row.designation).toBe("");
    expect(row.avatar).toBeNull();
    expect(row.accountStatus).toBe("deactivated");
  });

  test("deactivateAccount throws for a missing user without side effects", async () => {
    await expect(SettingsHelper.deactivateAccount(MISSING)).rejects.toThrow(/User not found/i);
  });

  test("reactivateAccount throws for a missing user", async () => {
    await expect(SettingsHelper.reactivateAccount(MISSING)).rejects.toThrow(/User not found/i);
  });

  test("reactivateAccount restores only posts/stories that were hidden, and clears nothing else", async () => {
    const u = await makeUser({ password: "OldPass123" });
    const live = await prisma.post.create({ data: { type: "image", authorId: u.id } });
    const story = await prisma.story.create({
      data: { authorId: u.id, expiresAt: new Date(Date.now() + 86400000) },
    });

    await SettingsHelper.deactivateAccount(u.id);
    expect((await prisma.post.findUnique({ where: { id: live.id } })).isDeleted).toBe(true);

    await SettingsHelper.reactivateAccount(u.id);

    expect((await prisma.post.findUnique({ where: { id: live.id } })).isDeleted).toBe(false);
    expect((await prisma.story.findUnique({ where: { id: story.id } })).isDeleted).toBe(false);

    // PRESERVED BEHAVIOR: reactivation restores status but does NOT restore
    // the anonymized bio/designation/avatar, and does not clear deactivatedAt.
    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { accountStatus: true, bio: true, deactivatedAt: true },
    });
    expect(row.accountStatus).toBe("active");
    expect(row.bio).toBe("");
    expect(row.deactivatedAt).not.toBeNull();
  });

  test("reactivation is exactly 30 days wide", async () => {
    const justInside = await makeUser({
      accountStatus: "deactivated",
      deactivatedAt: new Date(Date.now() - 29 * 86400000),
    });
    await expect(SettingsHelper.reactivateAccount(justInside.id)).resolves.toEqual({
      message: "Account reactivated successfully.",
    });

    const justOutside = await makeUser({
      accountStatus: "deactivated",
      deactivatedAt: new Date(Date.now() - 30.5 * 86400000),
    });
    await expect(SettingsHelper.reactivateAccount(justOutside.id)).rejects.toThrow(/expired/i);
  });

  test("a deactivated account with a null deactivatedAt skips the window check", async () => {
    const u = await makeUser({ accountStatus: "deactivated", deactivatedAt: null });
    await expect(SettingsHelper.reactivateAccount(u.id)).resolves.toEqual({
      message: "Account reactivated successfully.",
    });
  });

  test("hardDeleteAccount cascades to the user's posts and sessions", async () => {
    const u = await makeUser({ password: "OldPass123" });
    const post = await prisma.post.create({ data: { type: "image", authorId: u.id } });
    await prisma.refreshToken.create({
      data: { userId: u.id, tokenHash: `dh_${u.id}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    await SettingsHelper.hardDeleteAccount(u.id);

    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await prisma.post.findUnique({ where: { id: post.id } })).toBeNull();
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// TRANSACTION SEMANTICS (Phase 7A Milestone 6)
//
// This is the first remaining helper with MULTIPLE callback-form
// transactions, so the four things the migration depends on are verified
// explicitly rather than inferred:
//   1. transactionRunner.run() propagates its `tx` into repository calls
//   2. bulk repository writes (updateManyWhere / deleteManyByUserId) honour
//      that tx and are rolled back with it
//   3. errors are normalized (RepositoryError subclasses) while preserving
//      .code/.name across the transaction boundary
//   4. rollback is all-or-nothing across every statement in the callback
// ─────────────────────────────────────────────────────────────────────────
describe("settingsHelpers — transaction propagation & rollback (Phase 7A)", () => {
  test("a repository write inside run() is invisible outside until commit, and is rolled back on throw", async () => {
    const u = await makeUser();
    const sentinel = "rollback-sentinel-bio";

    const err = await transactionRunner
      .run(async (tx) => {
        await userRepository.update(u.id, { bio: sentinel }, { tx });

        // prove the write landed INSIDE the transaction
        const insideTx = await userRepository.findById(u.id, { tx, select: { bio: true } });
        expect(insideTx.bio).toBe(sentinel);

        // ...and is not yet visible on a separate connection
        const outsideTx = await prisma.user.findUnique({
          where: { id: u.id },
          select: { bio: true },
        });
        expect(outsideTx.bio).not.toBe(sentinel);

        throw new Error("abort");
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    const after = await prisma.user.findUnique({ where: { id: u.id }, select: { bio: true } });
    expect(after.bio).not.toBe(sentinel); // rolled back
  });

  test("bulk writes (updateManyWhere / deleteManyByUserId) participate in the transaction and roll back", async () => {
    const u = await makeUser();
    const post = await prisma.post.create({ data: { type: "image", authorId: u.id } });
    const story = await prisma.story.create({
      data: { authorId: u.id, expiresAt: new Date(Date.now() + 86400000) },
    });
    await prisma.refreshToken.create({
      data: { userId: u.id, tokenHash: `tx_${u.id}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    const err = await transactionRunner
      .run(async (tx) => {
        // exactly the four statements deactivateAccount issues...
        await userRepository.update(u.id, { accountStatus: "deactivated" }, { tx });
        const posts = await socialPostRepository.updateManyWhere(
          { authorId: u.id },
          { isDeleted: true },
          { tx }
        );
        const stories = await storyRepository.updateManyWhere(
          { authorId: u.id },
          { isDeleted: true },
          { tx }
        );
        const sessions = await sessionRepository.deleteManyByUserId(u.id, { tx });

        // batch payloads report real counts
        expect(posts.count).toBe(1);
        expect(stories.count).toBe(1);
        expect(sessions.count).toBe(1);

        // ...then abort
        throw new Error("abort after bulk writes");
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();

    // every one of the four is rolled back
    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { accountStatus: true },
    });
    expect(row.accountStatus).toBe("active");
    expect((await prisma.post.findUnique({ where: { id: post.id } })).isDeleted).toBe(false);
    expect((await prisma.story.findUnique({ where: { id: story.id } })).isDeleted).toBe(false);
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(1);
  });

  test("a failing statement mid-callback rolls back the earlier successful ones", async () => {
    // Mirrors deactivateAccount's shape: user.update succeeds, then a later
    // statement fails against a missing row.
    const u = await makeUser();
    const post = await prisma.post.create({ data: { type: "image", authorId: u.id } });

    const err = await transactionRunner
      .run(async (tx) => {
        await userRepository.update(u.id, { accountStatus: "deactivated" }, { tx });
        await socialPostRepository.updateManyWhere({ authorId: u.id }, { isDeleted: true }, { tx });
        // this one throws — the user row does not exist
        await userRepository.update(MISSING, { bio: "nope" }, { tx });
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    expect(err.code).toBe("P2025"); // normalized code survives the boundary
    expect(err.name).toBe("NotFoundError");
    expect(err.cause).toBeInstanceOf(NotFoundError);

    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { accountStatus: true },
    });
    expect(row.accountStatus).toBe("active"); // rolled back
    expect((await prisma.post.findUnique({ where: { id: post.id } })).isDeleted).toBe(false);
  });

  test("a bulk write matching nothing succeeds with count 0 rather than throwing", async () => {
    // deactivateAccount runs its post/story updateMany unconditionally, so a
    // user with no content must NOT fail — unlike delete(), which throws
    // NotFoundError when nothing matches.
    const u = await makeUser();

    await expect(SettingsHelper.deactivateAccount(u.id)).resolves.toEqual({
      message: "Account deactivated successfully.",
    });

    const zero = await socialPostRepository.updateManyWhere(
      { authorId: u.id },
      { isDeleted: true }
    );
    expect(zero.count).toBe(0);

    const noSessions = await sessionRepository.deleteManyByUserId(u.id);
    expect(noSessions.count).toBe(0);
  });

  test("both helper transactions commit atomically end-to-end", async () => {
    const u = await makeUser();
    const post = await prisma.post.create({ data: { type: "image", authorId: u.id } });
    const story = await prisma.story.create({
      data: { authorId: u.id, expiresAt: new Date(Date.now() + 86400000) },
    });
    await prisma.refreshToken.create({
      data: { userId: u.id, tokenHash: `both_${u.id}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    // transaction 1 — deactivate
    await SettingsHelper.deactivateAccount(u.id);
    expect((await prisma.post.findUnique({ where: { id: post.id } })).isDeleted).toBe(true);
    expect((await prisma.story.findUnique({ where: { id: story.id } })).isDeleted).toBe(true);
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);

    // transaction 2 — reactivate
    await SettingsHelper.reactivateAccount(u.id);
    expect((await prisma.post.findUnique({ where: { id: post.id } })).isDeleted).toBe(false);
    expect((await prisma.story.findUnique({ where: { id: story.id } })).isDeleted).toBe(false);
    const row = await prisma.user.findUnique({
      where: { id: u.id },
      select: { accountStatus: true },
    });
    expect(row.accountStatus).toBe("active");
  });

  test("updateManyWhere passes the filter through verbatim, with no soft-delete scoping", async () => {
    // reactivateAccount relies on being able to filter ON isDeleted:true and
    // flip it to false. A repository that silently appended
    // `isDeleted: false` (as findMany/count do) would match nothing.
    const u = await makeUser();
    const hidden = await prisma.post.create({
      data: { type: "image", authorId: u.id, isDeleted: true },
    });
    const visible = await prisma.post.create({ data: { type: "image", authorId: u.id } });

    const result = await socialPostRepository.updateManyWhere(
      { authorId: u.id, isDeleted: true },
      { isDeleted: false }
    );

    expect(result.count).toBe(1); // only the hidden one matched
    expect((await prisma.post.findUnique({ where: { id: hidden.id } })).isDeleted).toBe(false);
    expect((await prisma.post.findUnique({ where: { id: visible.id } })).isDeleted).toBe(false);
  });
});
