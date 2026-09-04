// Characterization test for the `consent` domain (Milestone 5C).
// consent.controller.js has no existing helper, so the baseline
// characterizes the CURRENT observable DB behavior via the exact inline
// operations the controller performs. After a minimal consentHelpers.js is
// extracted, the same assertions are re-expressed against the helper and
// must match — proving the extraction is behavior-preserving.
import { PrismaClient } from "@prisma/client";
import * as ConsentHelper from "../../src/utils/consentHelpers.js";

const prisma = new PrismaClient();

const sessionIds = [];
function newSessionId() {
  const s = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  sessionIds.push(s);
  return s;
}

afterAll(async () => {
  await prisma.consent.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.$disconnect();
});

// Mirrors saveConsent's upsert exactly (the controller-prepared values are
// passed in the same shape the controller builds them).
async function inlineUpsert({ sessionId, policyVersion, userId, analytics, marketing, ipAddress, userAgent }) {
  return prisma.consent.upsert({
    where: { sessionId_policyVersion: { sessionId, policyVersion } },
    update: { userId, analytics, marketing, ipAddress, userAgent, consentGivenAt: new Date() },
    create: { sessionId, userId, analytics, marketing, policyVersion, ipAddress, userAgent, consentGivenAt: new Date() },
  });
}

// Mirrors getConsent's findFirst exactly.
async function inlineGetLatest(sessionId) {
  return prisma.consent.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: { analytics: true, marketing: true, policyVersion: true, updatedAt: true },
  });
}

describe("consent — current DB behavior (baseline characterization)", () => {
  test("upsert creates a consent record the first time", async () => {
    const sessionId = newSessionId();
    const consent = await inlineUpsert({
      sessionId, policyVersion: "1.0", userId: null, analytics: true, marketing: false, ipAddress: "1.2.3.4", userAgent: "jest",
    });
    expect(consent.sessionId).toBe(sessionId);
    expect(consent.analytics).toBe(true);
    expect(consent.marketing).toBe(false);
    expect(consent.policyVersion).toBe("1.0");
  });

  test("upsert on the same sessionId+version updates the existing record", async () => {
    const sessionId = newSessionId();
    await inlineUpsert({ sessionId, policyVersion: "1.0", userId: null, analytics: false, marketing: false, ipAddress: "1.2.3.4", userAgent: "jest" });
    const updated = await inlineUpsert({ sessionId, policyVersion: "1.0", userId: null, analytics: true, marketing: true, ipAddress: "5.6.7.8", userAgent: "jest2" });
    expect(updated.analytics).toBe(true);
    expect(updated.marketing).toBe(true);
    const count = await prisma.consent.count({ where: { sessionId } });
    expect(count).toBe(1); // upsert updated, did not create a second row
  });

  test("getLatest returns the selected shape and null when absent", async () => {
    const sessionId = newSessionId();
    await inlineUpsert({ sessionId, policyVersion: "1.0", userId: null, analytics: true, marketing: false, ipAddress: null, userAgent: null });
    const found = await inlineGetLatest(sessionId);
    expect(Object.keys(found).sort()).toEqual(["analytics", "marketing", "policyVersion", "updatedAt"].sort());
    expect(await inlineGetLatest("nonexistent-session-xyz")).toBeNull();
  });

  test("getLatest returns the most recently created version", async () => {
    const sessionId = newSessionId();
    await inlineUpsert({ sessionId, policyVersion: "1.0", userId: null, analytics: false, marketing: false, ipAddress: null, userAgent: null });
    await new Promise((r) => setTimeout(r, 10));
    await inlineUpsert({ sessionId, policyVersion: "1.1", userId: null, analytics: true, marketing: false, ipAddress: null, userAgent: null });
    const latest = await inlineGetLatest(sessionId);
    expect(latest.policyVersion).toBe("1.1");
  });
});

// After extraction: the consentHelpers functions must produce behavior
// identical to the inline operations characterized above.
describe("consentHelpers — extracted persistence matches inline behavior", () => {
  test("upsertConsent creates then updates a single row for a sessionId+version", async () => {
    const sessionId = newSessionId();
    const created = await ConsentHelper.upsertConsent({
      sessionId, policyVersion: "1.0", userId: null, analytics: true, marketing: false, ipAddress: "1.2.3.4", userAgent: "jest",
    });
    expect(created.sessionId).toBe(sessionId);
    expect(created.analytics).toBe(true);

    const updated = await ConsentHelper.upsertConsent({
      sessionId, policyVersion: "1.0", userId: null, analytics: false, marketing: true, ipAddress: "5.6.7.8", userAgent: "jest2",
    });
    expect(updated.analytics).toBe(false);
    expect(updated.marketing).toBe(true);
    expect(await prisma.consent.count({ where: { sessionId } })).toBe(1);
  });

  test("getLatestConsent returns the selected shape, latest version, null when absent", async () => {
    const sessionId = newSessionId();
    await ConsentHelper.upsertConsent({ sessionId, policyVersion: "1.0", userId: null, analytics: false, marketing: false, ipAddress: null, userAgent: null });
    await new Promise((r) => setTimeout(r, 10));
    await ConsentHelper.upsertConsent({ sessionId, policyVersion: "1.2", userId: null, analytics: true, marketing: false, ipAddress: null, userAgent: null });
    const latest = await ConsentHelper.getLatestConsent(sessionId);
    expect(Object.keys(latest).sort()).toEqual(["analytics", "marketing", "policyVersion", "updatedAt"].sort());
    expect(latest.policyVersion).toBe("1.2");
    expect(await ConsentHelper.getLatestConsent("nonexistent-session-abc")).toBeNull();
  });
});

// ── Phase 7B / M-1, Batch 3 — ConsentRepository boundary regression ──────
describe("M-1 Batch 3 — consent repository boundary", () => {
  test("bare equality and caller-owned orderBy survive translation unchanged", async () => {
    const { consentRepository } = await import("../../src/config/repositories.js");
    const sid = `m1b3_${Date.now()}`;
    await prisma.consent.create({ data: {
      sessionId: sid, policyVersion: "v1", essential: true, analytics: true, marketing: false,
    } });

    const filter = { sessionId: sid };
    expect(await consentRepository.count(filter)).toBe(await prisma.consent.count({ where: filter }));

    const viaRepo = await consentRepository.findFirstWhere(filter, { orderBy: { createdAt: "desc" } });
    const inline  = await prisma.consent.findFirst({ where: filter, orderBy: { createdAt: "desc" } });
    expect(viaRepo.id).toBe(inline.id);

    await prisma.consent.deleteMany({ where: { sessionId: sid } });
  });

  test("M-1 GUARANTEE: Prisma-shaped filters are rejected", async () => {
    const { consentRepository } = await import("../../src/config/repositories.js");
    await expect(consentRepository.count({ sessionId: { contains: "x" } })).rejects.toThrow(/contains/);
  });
});
