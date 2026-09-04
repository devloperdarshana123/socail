// Characterization test for the `admin.auth` domain (Milestone 6B).
// Second admin controller — validates the admin helper convention on
// AUTHENTICATION-SENSITIVE code.
//
// Baseline characterizes current behavior via exact inline mirrors of the
// controller's 6 queries; after extraction into the NEW adminAuthHelpers.js
// the same assertions are re-expressed against those helpers.
//
// EXTERNAL DEPENDENCIES — none contacted:
//   • JWT / bcrypt / crypto — pure local computation (no network). Used
//     directly here to build realistic fixtures (hashed passwords, hashed
//     refresh tokens) exactly as the controller does.
//   • cookies / sendAdminToken — response-layer concerns; AVOIDED by
//     testing the persistence helpers rather than importing the controller.
//   • Redis / blacklistToken — cache-only, not persistence; AVOIDED.
//   • email — not used by this controller at all.
//
// FROZEN: no JWT generation, cookie handling, hashing, crypto or blacklist
// logic moves into the helper — those stay controller responsibilities, so
// nothing here asserts on them beyond building fixtures.
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import * as AdminAuthHelper from "../../src/utils/adminAuthHelpers.js";

const prisma = new PrismaClient();

const userIds = [];

// Same hashing the controller uses for refresh tokens (crypto stays in the
// controller; replicated here only to build realistic stored-token rows).
function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function makeUser({ role = "super_admin", accountStatus = "active", password = "AdminPass1" } = {}) {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: {
      fullName: `Admin ${s}`,
      email: `admin-${s}@e.com`,
      username: `admin_${s}`,
      role,
      accountStatus,
      ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
    },
  });
  userIds.push(u.id);
  return u;
}

async function makeRefreshToken(userId, rawToken, { expiresAt = new Date(Date.now() + 7 * 86400000), deviceInfo = "jest-device", ipAddress = "127.0.0.1" } = {}) {
  return prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt, deviceInfo, ipAddress },
  });
}

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// Exact mirrors of the controller's select shapes.
const LOGIN_SELECT = {
  id: true, fullName: true, email: true, username: true,
  password: true, role: true, accountStatus: true, avatar: true,
};
const REFRESH_SELECT = {
  id: true, fullName: true, email: true, username: true,
  role: true, accountStatus: true, avatar: true,
};

describe("admin auth — authentication lookup (inline mirror)", () => {
  test("login lookup finds an admin by lowercased email and INCLUDES password", async () => {
    const admin = await makeUser();
    const found = await prisma.user.findUnique({
      where: { email: admin.email.trim().toLowerCase() },
      select: LOGIN_SELECT,
    });
    expect(Object.keys(found).sort()).toEqual(Object.keys(LOGIN_SELECT).sort());
    expect(found.id).toBe(admin.id);
    expect(found.password).toBeTruthy(); // needed for verifyPassword
    expect(found.role).toBe("super_admin");
  });

  test("login lookup is case-insensitive via the controller's .toLowerCase()", async () => {
    const admin = await makeUser();
    const found = await prisma.user.findUnique({
      where: { email: admin.email.toUpperCase().trim().toLowerCase() },
      select: LOGIN_SELECT,
    });
    expect(found.id).toBe(admin.id);
  });

  test("login lookup returns null for an unknown email (401 path)", async () => {
    expect(await prisma.user.findUnique({
      where: { email: `nobody-${Date.now()}@e.com` },
      select: LOGIN_SELECT,
    })).toBeNull();
  });

  test("invalid credentials: bcrypt rejects a wrong password against the stored hash", async () => {
    const admin = await makeUser({ password: "AdminPass1" });
    const found = await prisma.user.findUnique({ where: { email: admin.email }, select: LOGIN_SELECT });
    expect(await bcrypt.compare("WrongPass9", found.password)).toBe(false);
    expect(await bcrypt.compare("AdminPass1", found.password)).toBe(true);
  });

  test("a user with no password is distinguishable (401 path)", async () => {
    const noPass = await makeUser({ password: null });
    const found = await prisma.user.findUnique({ where: { email: noPass.email }, select: LOGIN_SELECT });
    expect(found.password).toBeNull();
  });

  test("unauthorized access: a non-admin role is visible on the lookup (403 path)", async () => {
    const regular = await makeUser({ role: "user" });
    const found = await prisma.user.findUnique({ where: { email: regular.email }, select: LOGIN_SELECT });
    expect(found.role).toBe("user");
    expect(found.role).not.toBe("super_admin");
  });

  test("account status values drive the 403 branches", async () => {
    for (const status of ["banned", "suspended", "deactivated"]) {
      const u = await makeUser({ accountStatus: status });
      const found = await prisma.user.findUnique({ where: { email: u.email }, select: LOGIN_SELECT });
      expect(found.accountStatus).toBe(status);
    }
  });

  test("refresh lookup by id EXCLUDES password (different select from login)", async () => {
    const admin = await makeUser();
    const found = await prisma.user.findUnique({ where: { id: admin.id }, select: REFRESH_SELECT });
    expect(Object.keys(found).sort()).toEqual(Object.keys(REFRESH_SELECT).sort());
    expect(found).not.toHaveProperty("password"); // key security property
    expect(await prisma.user.findUnique({
      where: { id: "00000000-0000-0000-0000-000000000000" }, select: REFRESH_SELECT,
    })).toBeNull();
  });
});

describe("admin auth — session lookup (inline mirror)", () => {
  test("finds a valid, unexpired stored token by userId + hash", async () => {
    const admin = await makeUser();
    const raw = `raw_${Date.now()}`;
    await makeRefreshToken(admin.id, raw);

    const stored = await prisma.refreshToken.findFirst({
      where: { userId: admin.id, tokenHash: hashToken(raw), expiresAt: { gt: new Date() } },
    });
    expect(stored).not.toBeNull();
    expect(stored.deviceInfo).toBe("jest-device");
    expect(stored.ipAddress).toBe("127.0.0.1");
  });

  test("expired session: an expired token is NOT returned (401 path)", async () => {
    const admin = await makeUser();
    const raw = `expired_${Date.now()}`;
    await makeRefreshToken(admin.id, raw, { expiresAt: new Date(Date.now() - 1000) });

    const stored = await prisma.refreshToken.findFirst({
      where: { userId: admin.id, tokenHash: hashToken(raw), expiresAt: { gt: new Date() } },
    });
    expect(stored).toBeNull();
  });

  test("a token belonging to another user is not returned (scoped by userId)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const raw = `scoped_${Date.now()}`;
    await makeRefreshToken(a.id, raw);

    const stored = await prisma.refreshToken.findFirst({
      where: { userId: b.id, tokenHash: hashToken(raw), expiresAt: { gt: new Date() } },
    });
    expect(stored).toBeNull();
  });

  test("an unknown hash is not returned", async () => {
    const admin = await makeUser();
    await makeRefreshToken(admin.id, `known_${Date.now()}`);
    const stored = await prisma.refreshToken.findFirst({
      where: { userId: admin.id, tokenHash: hashToken("never-issued"), expiresAt: { gt: new Date() } },
    });
    expect(stored).toBeNull();
  });
});

describe("admin auth — token management & cleanup (inline mirror)", () => {
  test("logout deletes only the matching token, leaving other sessions intact", async () => {
    const admin = await makeUser();
    const rawA = `sessA_${Date.now()}`;
    const rawB = `sessB_${Date.now()}`;
    await makeRefreshToken(admin.id, rawA);
    await makeRefreshToken(admin.id, rawB);
    expect(await prisma.refreshToken.count({ where: { userId: admin.id } })).toBe(2);

    await prisma.refreshToken.deleteMany({ where: { userId: admin.id, tokenHash: hashToken(rawA) } });

    expect(await prisma.refreshToken.count({ where: { userId: admin.id } })).toBe(1);
    const remaining = await prisma.refreshToken.findFirst({ where: { userId: admin.id } });
    expect(remaining.tokenHash).toBe(hashToken(rawB)); // other device stays logged in
  });

  test("logout deleteMany is a no-op for an unknown token", async () => {
    const admin = await makeUser();
    await makeRefreshToken(admin.id, `keep_${Date.now()}`);
    const res = await prisma.refreshToken.deleteMany({ where: { userId: admin.id, tokenHash: hashToken("nope") } });
    expect(res.count).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: admin.id } })).toBe(1);
  });

  test("rotation/revoke deletes a stored token by id", async () => {
    const admin = await makeUser();
    const raw = `rot_${Date.now()}`;
    const stored = await makeRefreshToken(admin.id, raw);

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    expect(await prisma.refreshToken.findUnique({ where: { id: stored.id } })).toBeNull();
  });
});

// After extraction: the 5 helpers must match the inline behavior exactly.
describe("adminAuthHelpers — extracted queries match inline behavior", () => {
  const MISSING = "00000000-0000-0000-0000-000000000000";

  test("findAdminByEmail returns the login select (WITH password), null for unknown", async () => {
    const admin = await makeUser();
    const found = await AdminAuthHelper.findAdminByEmail(admin.email);
    expect(Object.keys(found).sort()).toEqual(Object.keys(LOGIN_SELECT).sort());
    expect(found.id).toBe(admin.id);
    expect(found.password).toBeTruthy();
    expect(await AdminAuthHelper.findAdminByEmail(`nobody-${Date.now()}@e.com`)).toBeNull();
  });

  test("findAdminById returns the refresh select (WITHOUT password), null for missing", async () => {
    const admin = await makeUser();
    const found = await AdminAuthHelper.findAdminById(admin.id);
    expect(Object.keys(found).sort()).toEqual(Object.keys(REFRESH_SELECT).sort());
    expect(found).not.toHaveProperty("password"); // security property preserved
    expect(await AdminAuthHelper.findAdminById(MISSING)).toBeNull();
  });

  test("findValidAdminRefreshToken honours userId + hash + expiry", async () => {
    const admin = await makeUser();
    const raw = `hraw_${Date.now()}`;
    await makeRefreshToken(admin.id, raw);

    const ok = await AdminAuthHelper.findValidAdminRefreshToken(admin.id, hashToken(raw), new Date());
    expect(ok).not.toBeNull();
    expect(ok.deviceInfo).toBe("jest-device");

    // wrong hash, wrong user, and expired all return null
    expect(await AdminAuthHelper.findValidAdminRefreshToken(admin.id, hashToken("other"), new Date())).toBeNull();
    const other = await makeUser();
    expect(await AdminAuthHelper.findValidAdminRefreshToken(other.id, hashToken(raw), new Date())).toBeNull();

    const expRaw = `hexp_${Date.now()}`;
    await makeRefreshToken(admin.id, expRaw, { expiresAt: new Date(Date.now() - 1000) });
    expect(await AdminAuthHelper.findValidAdminRefreshToken(admin.id, hashToken(expRaw), new Date())).toBeNull();
  });

  test("deleteAdminRefreshTokenByHash removes only the matching session", async () => {
    const admin = await makeUser();
    const rawA = `hA_${Date.now()}`;
    const rawB = `hB_${Date.now()}`;
    await makeRefreshToken(admin.id, rawA);
    await makeRefreshToken(admin.id, rawB);

    const res = await AdminAuthHelper.deleteAdminRefreshTokenByHash(admin.id, hashToken(rawA));
    expect(res.count).toBe(1);
    expect(await prisma.refreshToken.count({ where: { userId: admin.id } })).toBe(1);

    // no-op for an unknown hash
    expect((await AdminAuthHelper.deleteAdminRefreshTokenByHash(admin.id, hashToken("nope"))).count).toBe(0);
  });

  test("deleteAdminRefreshTokenById removes the stored token (revoke + rotation paths)", async () => {
    const admin = await makeUser();
    const stored = await makeRefreshToken(admin.id, `hid_${Date.now()}`);
    await AdminAuthHelper.deleteAdminRefreshTokenById(stored.id);
    expect(await prisma.refreshToken.findUnique({ where: { id: stored.id } })).toBeNull();
  });
});
