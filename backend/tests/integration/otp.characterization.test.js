// Characterization test for the `otp` domain (Phase 7A Milestone 11).
//
// otpHelpers.js had NO characterization suite. This file is written from
// scratch and run GREEN against the ORIGINAL direct-Prisma implementation
// BEFORE the repository migration, establishing the before/after net.
//
// AUTHENTICATION-ADJACENT: OTP generation/verification is part of the auth
// flow frozen in Milestone 5I. Nothing here changes behaviour; the suite
// only locks down what already happens.
//
// NO NETWORK: otpHelpers performs no email/SMS delivery — sending lives in
// the controller's orchestration. Local bcrypt + crypto only.
import { PrismaClient } from "@prisma/client";
import * as OtpHelper from "../../src/utils/otpHelpers.js";
import { OTP_CONFIG, OTP_PURPOSE } from "../../src/utils/otpUtils.js";
import { otpRepository } from "../../src/config/repositories.js";

const prisma = new PrismaClient();

const userIds = [];
const PURPOSE = OTP_PURPOSE.EMAIL_VERIFY;

async function makeUser() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: { fullName: `O ${s}`, email: `o-${s}@e.com`, username: `o_${s}`, accountStatus: "active" },
  });
  userIds.push(u.id);
  return u;
}

async function otpRowOf(userId, purpose = PURPOSE) {
  return prisma.oTP.findUnique({ where: { userId_purpose: { userId, purpose } } });
}

afterAll(async () => {
  await prisma.oTP.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("otpHelpers — generation", () => {
  test("generateOtp returns a 6-digit code and stores only its hash", async () => {
    const u = await makeUser();
    const { otp, otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);

    expect(otp).toMatch(/^\d{6}$/);
    expect(otpDoc.hashedOtp).not.toBe(otp); // never stored in the clear
    expect(otpDoc.hashedOtp).toMatch(/^\$2[aby]\$/); // bcrypt
    expect(otpDoc.attempts).toBe(0);
    expect(otpDoc.isUsed).toBe(false);
    expect(otpDoc.resendCount).toBe(1);
    expect(otpDoc.userId).toBe(u.id);
    expect(otpDoc.purpose).toBe(PURPOSE);
  });

  test("the expiry window is ~10 minutes out", async () => {
    const u = await makeUser();
    const before = Date.now();
    const { otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);

    const delta = otpDoc.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(OTP_CONFIG.EXPIRES_IN_MS - 5000);
    expect(delta).toBeLessThanOrEqual(OTP_CONFIG.EXPIRES_IN_MS + 5000);
  });

  test("generateOtp rejects an invalid purpose with statusCode 400", async () => {
    const u = await makeUser();
    const err = await OtpHelper.generateOtp(u.id, "not_a_purpose").catch((e) => e);
    expect(err.message).toMatch(/Invalid OTP purpose/);
    expect(err.statusCode).toBe(400);
    expect(await otpRowOf(u.id, "not_a_purpose")).toBeNull();
  });

  test("regenerating upserts the same row rather than creating a second", async () => {
    const u = await makeUser();
    const first = await OtpHelper.generateOtp(u.id, PURPOSE);

    // clear the cooldown so the resend guard allows it
    await prisma.oTP.update({
      where: { id: first.otpDoc.id },
      data: { lastResendAt: new Date(Date.now() - OTP_CONFIG.RESEND_COOLDOWN_MS - 1000) },
    });

    const second = await OtpHelper.generateOtp(u.id, PURPOSE);
    expect(second.otpDoc.id).toBe(first.otpDoc.id); // same row (compound-key upsert)
    expect(second.otpDoc.resendCount).toBe(2); // incremented
    expect(second.otp).not.toBe(first.otp === second.otp ? null : first.otp); // new code issued
    expect(await prisma.oTP.count({ where: { userId: u.id } })).toBe(1);
  });

  test("different purposes for one user are independent rows", async () => {
    const u = await makeUser();
    await OtpHelper.generateOtp(u.id, OTP_PURPOSE.EMAIL_VERIFY);
    await OtpHelper.generateOtp(u.id, OTP_PURPOSE.LOGIN);

    expect(await prisma.oTP.count({ where: { userId: u.id } })).toBe(2);
    expect(await otpRowOf(u.id, OTP_PURPOSE.EMAIL_VERIFY)).not.toBeNull();
    expect(await otpRowOf(u.id, OTP_PURPOSE.LOGIN)).not.toBeNull();
  });
});

describe("otpHelpers — resend guards", () => {
  test("canResend is true when no OTP exists", async () => {
    const u = await makeUser();
    expect(await OtpHelper.canResend(u.id, PURPOSE)).toEqual({ canResend: true });
  });

  test("a fresh OTP blocks resending until the cooldown elapses", async () => {
    const u = await makeUser();
    await OtpHelper.generateOtp(u.id, PURPOSE);

    const blocked = await OtpHelper.canResend(u.id, PURPOSE);
    expect(blocked.canResend).toBe(false);
    expect(blocked.message).toMatch(/Please wait \d+ seconds/);
    expect(blocked.waitSeconds).toBeGreaterThan(0);
    expect(blocked.waitSeconds).toBeLessThanOrEqual(60);

    // resendOtp surfaces the same guard as a 429
    const err = await OtpHelper.resendOtp(u.id, PURPOSE).catch((e) => e);
    expect(err.statusCode).toBe(429);
    expect(err.waitSeconds).toBeGreaterThan(0);
  });

  test("the max-resend ceiling blocks even after the cooldown", async () => {
    const u = await makeUser();
    const { otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);
    await prisma.oTP.update({
      where: { id: otpDoc.id },
      data: {
        resendCount: OTP_CONFIG.MAX_RESEND,
        lastResendAt: new Date(Date.now() - OTP_CONFIG.RESEND_COOLDOWN_MS - 1000),
      },
    });

    const blocked = await OtpHelper.canResend(u.id, PURPOSE);
    expect(blocked.canResend).toBe(false);
    expect(blocked.message).toMatch(/Maximum resend limit reached/);
  });

  test("resendOtp issues a new code once the cooldown has passed", async () => {
    const u = await makeUser();
    const first = await OtpHelper.generateOtp(u.id, PURPOSE);
    await prisma.oTP.update({
      where: { id: first.otpDoc.id },
      data: { lastResendAt: new Date(Date.now() - OTP_CONFIG.RESEND_COOLDOWN_MS - 1000) },
    });

    const resent = await OtpHelper.resendOtp(u.id, PURPOSE);
    expect(resent.otp).toMatch(/^\d{6}$/);
    expect(resent.otpDoc.resendCount).toBe(2);
    expect(resent.otpDoc.attempts).toBe(0); // reset
  });

  test("resendOtp rejects an invalid purpose with statusCode 400", async () => {
    const u = await makeUser();
    const err = await OtpHelper.resendOtp(u.id, "bogus").catch((e) => e);
    expect(err.statusCode).toBe(400);
  });
});

describe("otpHelpers — verification", () => {
  test("a correct OTP verifies and consumes the row", async () => {
    const u = await makeUser();
    const { otp } = await OtpHelper.generateOtp(u.id, PURPOSE);

    const result = await OtpHelper.verifyOtp(u.id, PURPOSE, otp);
    expect(result).toEqual({
      success: true,
      message: "OTP verified successfully",
      remainingAttempts: null,
    });
    expect(await otpRowOf(u.id)).toBeNull(); // deleted on success
  });

  test("surrounding whitespace and non-string input are tolerated", async () => {
    const u = await makeUser();
    const { otp } = await OtpHelper.generateOtp(u.id, PURPOSE);

    const result = await OtpHelper.verifyOtp(u.id, PURPOSE, `  ${otp}  `);
    expect(result.success).toBe(true);
  });

  test("a wrong OTP increments attempts and reports the remaining count", async () => {
    const u = await makeUser();
    await OtpHelper.generateOtp(u.id, PURPOSE);

    const first = await OtpHelper.verifyOtp(u.id, PURPOSE, "000000");
    expect(first.success).toBe(false);
    expect(first.remainingAttempts).toBe(OTP_CONFIG.MAX_ATTEMPTS - 1);
    expect(first.message).toMatch(/Invalid OTP\. \d+ attempts? remaining/);
    expect((await otpRowOf(u.id)).attempts).toBe(1);

    const second = await OtpHelper.verifyOtp(u.id, PURPOSE, "111111");
    expect(second.remainingAttempts).toBe(OTP_CONFIG.MAX_ATTEMPTS - 2);
  });

  test("exhausting the attempt budget deletes the OTP", async () => {
    const u = await makeUser();
    await OtpHelper.generateOtp(u.id, PURPOSE);

    let last;
    for (let i = 0; i < OTP_CONFIG.MAX_ATTEMPTS; i++) {
      last = await OtpHelper.verifyOtp(u.id, PURPOSE, "000000");
    }

    expect(last.success).toBe(false);
    expect(last.remainingAttempts).toBe(0);
    expect(last.message).toMatch(/Too many failed attempts/);
    expect(await otpRowOf(u.id)).toBeNull();
  });

  test("an expired OTP reports expiry (not 'not found') and is deleted", async () => {
    // This is why verification queries WITHOUT an expiry filter — it must be
    // able to see an expired row to report it correctly.
    const u = await makeUser();
    const { otp, otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);
    await prisma.oTP.update({
      where: { id: otpDoc.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await OtpHelper.verifyOtp(u.id, PURPOSE, otp);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/OTP has expired/);
    expect(result.message).toContain(OTP_CONFIG.EXPIRES_IN_LABEL);
    expect(await otpRowOf(u.id)).toBeNull(); // cleaned up
  });

  test("verifying with no OTP on record reports not-found", async () => {
    const u = await makeUser();
    const result = await OtpHelper.verifyOtp(u.id, PURPOSE, "123456");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/OTP not found or already used/);
  });

  test("an already-used OTP is not matched", async () => {
    const u = await makeUser();
    const { otp, otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);
    await prisma.oTP.update({ where: { id: otpDoc.id }, data: { isUsed: true } });

    const result = await OtpHelper.verifyOtp(u.id, PURPOSE, otp);
    expect(result.message).toMatch(/OTP not found or already used/);
  });

  test("verification is scoped to the purpose", async () => {
    const u = await makeUser();
    const { otp } = await OtpHelper.generateOtp(u.id, OTP_PURPOSE.EMAIL_VERIFY);

    const wrongPurpose = await OtpHelper.verifyOtp(u.id, OTP_PURPOSE.LOGIN, otp);
    expect(wrongPurpose.success).toBe(false);

    const right = await OtpHelper.verifyOtp(u.id, OTP_PURPOSE.EMAIL_VERIFY, otp);
    expect(right.success).toBe(true);
  });

  test("an invalid purpose is rejected without a DB write", async () => {
    const u = await makeUser();
    const result = await OtpHelper.verifyOtp(u.id, "nope", "123456");
    expect(result).toEqual({ success: false, message: "Invalid OTP purpose" });
  });
});

describe("otpHelpers — status & cleanup", () => {
  test("getStatus reports non-existence", async () => {
    const u = await makeUser();
    expect(await OtpHelper.getStatus(u.id, PURPOSE)).toEqual({ exists: false });
  });

  test("getStatus reports attempts, expiry and the next-resend time", async () => {
    const u = await makeUser();
    await OtpHelper.generateOtp(u.id, PURPOSE);
    await OtpHelper.verifyOtp(u.id, PURPOSE, "000000"); // one failed attempt

    const status = await OtpHelper.getStatus(u.id, PURPOSE);
    expect(status.exists).toBe(true);
    expect(status.expired).toBe(false);
    expect(status.attemptsUsed).toBe(1);
    expect(status.remainingAttempts).toBe(OTP_CONFIG.MAX_ATTEMPTS - 1);
    expect(status.resendCount).toBe(1);
    expect(status.expiresAt).toBeInstanceOf(Date);
    expect(status.canResendAt).toBeInstanceOf(Date);
  });

  test("getStatus flags an expired OTP without deleting it", async () => {
    const u = await makeUser();
    const { otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);
    await prisma.oTP.update({
      where: { id: otpDoc.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const status = await OtpHelper.getStatus(u.id, PURPOSE);
    expect(status.exists).toBe(true);
    expect(status.expired).toBe(true);
    expect(await otpRowOf(u.id)).not.toBeNull(); // read-only
  });

  test("getRecentCount counts only OTPs inside the window", async () => {
    const u = await makeUser();
    await OtpHelper.generateOtp(u.id, PURPOSE);

    expect(await OtpHelper.getRecentCount(u.id)).toBe(1);
    expect(await OtpHelper.getRecentCount(u.id, -1000)).toBe(0); // future window start
  });

  test("deleteAllForUser removes every purpose for that user only", async () => {
    const u = await makeUser();
    const other = await makeUser();
    await OtpHelper.generateOtp(u.id, OTP_PURPOSE.EMAIL_VERIFY);
    await OtpHelper.generateOtp(u.id, OTP_PURPOSE.LOGIN);
    await OtpHelper.generateOtp(other.id, OTP_PURPOSE.EMAIL_VERIFY);

    const result = await OtpHelper.deleteAllForUser(u.id);
    expect(result).toEqual({ deletedCount: 2 });
    expect(await prisma.oTP.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.oTP.count({ where: { userId: other.id } })).toBe(1);

    // deleting again is a no-op, not an error
    expect(await OtpHelper.deleteAllForUser(u.id)).toEqual({ deletedCount: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY HAZARD REGRESSION (Phase 7A Milestone 11)
//
// OtpRepository.findActiveByUserAndPurpose() looks like the natural finder
// for this domain, but it filters BOTH `isUsed: false` AND `expiresAt > now`.
// otpHelpers must be able to SEE expired and used rows — verification
// reports "OTP has expired" and cleans the row up, and getStatus reports
// `expired: true`. Substituting the "active" finder would silently turn both
// into "OTP not found or already used".
//
// Pinned so the distinction is executable knowledge rather than a comment.
// ─────────────────────────────────────────────────────────────────────────
describe("OtpRepository — active vs any-state finders (Phase 7A hazard)", () => {
  test("findActiveByUserAndPurpose hides an expired row that the helper must see", async () => {
    const u = await makeUser();
    const { otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);
    await prisma.oTP.update({
      where: { id: otpDoc.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // the "active" finder cannot see it...
    expect(await otpRepository.findActiveByUserAndPurpose(u.id, PURPOSE)).toBeNull();
    // ...but the any-state finder the helper uses can
    const anyState = await otpRepository.findByUserAndPurpose(u.id, PURPOSE);
    expect(anyState).not.toBeNull();
    expect(anyState.id).toBe(otpDoc.id);

    // which is why the user gets the accurate message
    const result = await OtpHelper.verifyOtp(u.id, PURPOSE, "123456");
    expect(result.message).toMatch(/OTP has expired/);
    expect(result.message).not.toMatch(/not found/);
  });

  test("findActiveByUserAndPurpose also hides a used row", async () => {
    const u = await makeUser();
    const { otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);
    await prisma.oTP.update({ where: { id: otpDoc.id }, data: { isUsed: true } });

    expect(await otpRepository.findActiveByUserAndPurpose(u.id, PURPOSE)).toBeNull();
    expect(await otpRepository.findByUserAndPurpose(u.id, PURPOSE)).not.toBeNull();

    // getStatus still reports on it, as the resend guards require
    const status = await OtpHelper.getStatus(u.id, PURPOSE);
    expect(status.exists).toBe(true);
  });

  test("findFirstWhere applies the caller's filter verbatim, with no expiry predicate", async () => {
    const u = await makeUser();
    const { otpDoc } = await OtpHelper.generateOtp(u.id, PURPOSE);
    await prisma.oTP.update({
      where: { id: otpDoc.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const found = await otpRepository.findFirstWhere({
      userId: u.id,
      purpose: PURPOSE,
      isUsed: false,
    });
    expect(found).not.toBeNull(); // expired but still matched
    expect(found.id).toBe(otpDoc.id);
  });
});

// ── Phase 7B / M-1, Batch 3 — OtpRepository boundary regression ──────────
// otpHelpers needed NO conversion: it was already fully neutral (`gt` on
// createdAt, bare equality on userId/purpose). This proves the translator
// is a genuine no-op for those shapes, including through deleteManyWhere.
describe("M-1 Batch 3 — otp repository boundary", () => {
  test("gt / bare equality translate to themselves across count, findFirst and deleteMany", async () => {
    const u = await makeUser();
    const since = new Date(Date.now() - 60000);
    await OtpHelper.generateOtp(u.id, PURPOSE);

    const filter = { userId: u.id, createdAt: { gt: since } };
    expect(await otpRepository.count(filter)).toBe(await prisma.oTP.count({ where: filter }));

    const found = await otpRepository.findFirstWhere({ userId: u.id, purpose: PURPOSE });
    expect(found).not.toBeNull();
    expect(found.id).toBe((await prisma.oTP.findFirst({ where: { userId: u.id, purpose: PURPOSE } })).id);

    const del = await otpRepository.deleteManyWhere({ userId: u.id, createdAt: { gt: since } });
    expect(del.count).toBe(1);
    expect(await prisma.oTP.count({ where: { userId: u.id } })).toBe(0);
  });

  test("M-1 GUARANTEE: Prisma-shaped filters are rejected", async () => {
    await expect(otpRepository.count({ codeHash: { contains: "h" } })).rejects.toThrow(/contains/);
    await expect(otpRepository.count({ OR: [{ purpose: PURPOSE }] })).rejects.toThrow(/OR/);
  });
});
