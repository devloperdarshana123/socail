// Characterization test for the `auth` domain (Milestone 5I).
// Authentication behavior is FROZEN — this locks down the persistence
// behavior behind every auth endpoint against a real Postgres BEFORE the
// 7 direct Prisma call-sites are extracted into userHelpers.js.
//
// EXTERNAL PROVIDERS — never contacted. This file imports ONLY
// userHelpers/otpHelpers (pure DB) and the Prisma client. It deliberately
// does NOT import auth.controller.js, because that module calls
// firebase-admin initializeApp() at import time. Isolation per dependency:
//   • Firebase (verifyIdToken / initializeApp) — AVOIDED (controller not imported)
//   • Brevo email (sendTemplateMail)          — AVOIDED (fire-and-forget, post-persistence)
//   • notifyAdmin (HTTP to chat-server)       — AVOIDED (same)
//   • JWT / cookies / sendUserToken           — AVOIDED (frozen, untouched by helpers)
//   • Redis                                    — AVOIDED (cache-only, not persistence)
//   • OTP helpers                              — REAL, but pure DB (no network)
import { PrismaClient } from "@prisma/client";
import * as UserHelper from "../../src/utils/userHelpers.js";
import * as OtpHelper from "../../src/utils/otpHelpers.js";
import { OTP_PURPOSE } from "../../src/utils/otpUtils.js";

const prisma = new PrismaClient();

const userIds = [];
function track(u) { userIds.push(u.id); return u; }
function stamp() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

afterAll(async () => {
  await prisma.oTP.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("auth persistence — registration & lookups (characterization)", () => {
  test("register creates an email user with pending status and onboardingStep 1", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: {
        fullName: "Reg User",
        authProvider: "email",
        accountStatus: "pending",
        onboardingStep: 1,
        email: `reg-${s}@example.com`,
        password: await UserHelper.hashPassword("ValidPass1"),
      },
    }));
    expect(user.accountStatus).toBe("pending");
    expect(user.onboardingStep).toBe(1);
    expect(user.authProvider).toBe("email");
    expect(user.isEmailVerified).toBe(false);
    // password is stored hashed, never plaintext
    expect(user.password).not.toBe("ValidPass1");
    expect(await UserHelper.isPasswordCorrect(user, "ValidPass1")).toBe(true);
  });

  test("register creates a phone user (no email, no password)", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: { fullName: "Phone User", authProvider: "phone", accountStatus: "pending", onboardingStep: 1, phoneNumber: `+9199${s.slice(-8)}` },
    }));
    expect(user.authProvider).toBe("phone");
    expect(user.email).toBeNull();
    expect(user.password).toBeNull();
  });

  test("duplicate-guard lookups: findByEmail / findByPhone / findByUsername", async () => {
    const s = stamp();
    const email = `dup-${s}@example.com`;
    const phone = `+9188${s.slice(-8)}`;
    const username = `dup_${s}`;
    track(await prisma.user.create({ data: { fullName: "Dup", email, phoneNumber: phone, username, accountStatus: "active" } }));

    expect((await UserHelper.findByEmail(email)).email).toBe(email);
    expect((await UserHelper.findByEmail(email.toUpperCase())).email).toBe(email); // lowercased lookup
    expect((await UserHelper.findByPhone(phone)).phoneNumber).toBe(phone);
    expect((await UserHelper.findByUsername(username)).username).toBe(username);
    expect(await UserHelper.findByEmail(`nobody-${s}@example.com`)).toBeNull();
  });
});

describe("auth persistence — OTP verification state transitions (characterization)", () => {
  test("verifyOtp EMAIL_VERIFY update sets isEmailVerified, step 2, pending", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: { fullName: "OTP User", email: `otp-${s}@example.com`, accountStatus: "pending", onboardingStep: 1 },
    }));

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, onboardingStep: 2, accountStatus: "pending" },
    });
    expect(updated.isEmailVerified).toBe(true);
    expect(updated.onboardingStep).toBe(2);
    expect(updated.accountStatus).toBe("pending");
  });

  test("verifyOtp MOBILE_VERIFY update sets isMobileVerified, step 2, pending", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: { fullName: "OTP Phone", phoneNumber: `+9177${s.slice(-8)}`, accountStatus: "pending", onboardingStep: 1 },
    }));

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isMobileVerified: true, onboardingStep: 2, accountStatus: "pending" },
    });
    expect(updated.isMobileVerified).toBe(true);
    expect(updated.onboardingStep).toBe(2);
  });

  test("OTP generate + verify round-trip (pure DB, no network)", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: { fullName: "OTP RT", email: `otprt-${s}@example.com`, accountStatus: "pending" },
    }));
    const { otp } = await OtpHelper.generateOtp(user.id, OTP_PURPOSE.EMAIL_VERIFY);
    expect(typeof otp).toBe("string");

    const wrong = await OtpHelper.verifyOtp(user.id, OTP_PURPOSE.EMAIL_VERIFY, "000000");
    expect(wrong.success).toBe(false);

    const ok = await OtpHelper.verifyOtp(user.id, OTP_PURPOSE.EMAIL_VERIFY, otp);
    expect(ok.success).toBe(true);
  });
});

describe("auth persistence — onboarding & password reset (characterization)", () => {
  test("setUsername update activates the account and completes onboarding", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: { fullName: "Onboard", email: `ob-${s}@example.com`, accountStatus: "pending", onboardingStep: 2 },
    }));
    const trimmed = `ob_${s}`;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { username: trimmed, onboardingStep: 3, accountStatus: "active", isOnboardingComplete: true },
    });
    expect(updated.username).toBe(trimmed);
    expect(updated.onboardingStep).toBe(3);
    expect(updated.accountStatus).toBe("active");
    expect(updated.isOnboardingComplete).toBe(true);
  });

  test("resetPassword update stores the new hash and invalidates all refresh tokens", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: { fullName: "Reset", email: `rst-${s}@example.com`, accountStatus: "active", password: await UserHelper.hashPassword("OldPass1") },
    }));
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: `hash_${s}`, expiresAt: new Date(Date.now() + 86400000) },
    });

    const newHash = await UserHelper.hashPassword("NewPass2");
    const updated = await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
    expect(await UserHelper.isPasswordCorrect(updated, "NewPass2")).toBe(true);
    expect(await UserHelper.isPasswordCorrect(updated, "OldPass1")).toBe(false);

    await UserHelper.removeAllRefreshTokens(user.id);
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("auth persistence — Google OAuth lookup/create/link (characterization)", () => {
  test("findFirst matches by firebaseUid OR email", async () => {
    const s = stamp();
    const email = `goog-${s}@example.com`;
    const uid = `firebase_${s}`;
    const user = track(await prisma.user.create({
      data: { fullName: "Goog", email, firebaseUid: uid, authProvider: "google", accountStatus: "active" },
    }));

    const byUid = await prisma.user.findFirst({ where: { OR: [{ firebaseUid: uid }, { email: "nomatch@example.com" }] } });
    expect(byUid.id).toBe(user.id);

    const byEmail = await prisma.user.findFirst({ where: { OR: [{ firebaseUid: "no_such_uid" }, { email: email.toLowerCase() }] } });
    expect(byEmail.id).toBe(user.id);

    const neither = await prisma.user.findFirst({ where: { OR: [{ firebaseUid: "no_such_uid" }, { email: `nobody-${s}@example.com` }] } });
    expect(neither).toBeNull();
  });

  test("Google create sets verified email, pending status, step 2, and avatar", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: {
        fullName: "Google User",
        email: `gnew-${s}@example.com`,
        firebaseUid: `guid_${s}`,
        authProvider: "google",
        isEmailVerified: true,
        accountStatus: "pending",
        onboardingStep: 2,
        avatar: { url: "http://pic/x.jpg", publicId: null },
      },
    }));
    expect(user.isEmailVerified).toBe(true);
    expect(user.authProvider).toBe("google");
    expect(user.onboardingStep).toBe(2);
    expect(user.avatar).toEqual({ url: "http://pic/x.jpg", publicId: null });
    expect(user.password).toBeNull(); // OAuth user has no password
  });

  test("Google link update attaches firebaseUid to an existing user (and avatar only if absent)", async () => {
    const s = stamp();
    const existing = track(await prisma.user.create({
      data: { fullName: "Existing", email: `link-${s}@example.com`, authProvider: "email", accountStatus: "active" },
    }));
    expect(existing.firebaseUid).toBeNull();

    const uid = `linkuid_${s}`;
    const linked = await prisma.user.update({
      where: { id: existing.id },
      data: { firebaseUid: uid, ...(!existing.avatar ? { avatar: { url: "http://pic/y.jpg", publicId: null } } : {}) },
    });
    expect(linked.firebaseUid).toBe(uid);
    expect(linked.avatar).toEqual({ url: "http://pic/y.jpg", publicId: null });
  });
});

describe("auth persistence — refresh token lifecycle (characterization)", () => {
  test("generate, look up by hash, and consume (rotation) a refresh token", async () => {
    const s = stamp();
    const user = track(await prisma.user.create({
      data: { fullName: "RT", email: `rt-${s}@example.com`, accountStatus: "active" },
    }));

    const raw = await UserHelper.generateRefreshToken(user, "jest-device", "127.0.0.1");
    const stored = await UserHelper.getRefreshTokenByHash(user.id, raw);
    expect(stored).not.toBeNull();
    expect(stored.deviceInfo).toBe("jest-device");

    const consumed = await UserHelper.consumeRefreshTokenByHash(user.id, raw);
    expect(consumed).toBe(true);
    // second consume fails — rotation/reuse protection
    expect(await UserHelper.consumeRefreshTokenByHash(user.id, raw)).toBe(false);
  });
});

// After extraction: the 3 helpers must match the inline behavior exactly.
describe("userHelpers — extracted auth queries match inline behavior", () => {
  test("createUser creates a user from controller-assembled data", async () => {
    const s = stamp();
    const user = track(await UserHelper.createUser({
      fullName: "Helper Created",
      authProvider: "email",
      accountStatus: "pending",
      onboardingStep: 1,
      email: `hc-${s}@example.com`,
      password: await UserHelper.hashPassword("ValidPass1"),
    }));
    expect(user.id).toBeTruthy();
    expect(user.accountStatus).toBe("pending");
    expect(user.onboardingStep).toBe(1);
    expect(await UserHelper.isPasswordCorrect(user, "ValidPass1")).toBe(true);
  });

  test("updateUserById applies verification, onboarding, and password updates", async () => {
    const s = stamp();
    const user = track(await UserHelper.createUser({
      fullName: "Helper Update", email: `hu-${s}@example.com`, accountStatus: "pending", onboardingStep: 1,
    }));

    // verifyOtp-shaped update
    const verified = await UserHelper.updateUserById(user.id, {
      isEmailVerified: true, onboardingStep: 2, accountStatus: "pending",
    });
    expect(verified.isEmailVerified).toBe(true);
    expect(verified.onboardingStep).toBe(2);

    // setUsername-shaped update
    const named = await UserHelper.updateUserById(user.id, {
      username: `hu_${s}`, onboardingStep: 3, accountStatus: "active", isOnboardingComplete: true,
    });
    expect(named.username).toBe(`hu_${s}`);
    expect(named.accountStatus).toBe("active");
    expect(named.isOnboardingComplete).toBe(true);

    // resetPassword-shaped update
    const newHash = await UserHelper.hashPassword("BrandNew2");
    const reset = await UserHelper.updateUserById(user.id, { password: newHash });
    expect(await UserHelper.isPasswordCorrect(reset, "BrandNew2")).toBe(true);
  });

  test("findByFirebaseUidOrEmail matches by uid OR email (email lowercased), null when neither", async () => {
    const s = stamp();
    const email = `hg-${s}@example.com`;
    const uid = `hguid_${s}`;
    const user = track(await UserHelper.createUser({
      fullName: "Helper Google", email, firebaseUid: uid, authProvider: "google", accountStatus: "active",
    }));

    expect((await UserHelper.findByFirebaseUidOrEmail(uid, "nomatch@example.com")).id).toBe(user.id);
    expect((await UserHelper.findByFirebaseUidOrEmail("no_such_uid", email.toUpperCase())).id).toBe(user.id);
    expect(await UserHelper.findByFirebaseUidOrEmail("no_such_uid", `nobody-${s}@example.com`)).toBeNull();
  });
});
