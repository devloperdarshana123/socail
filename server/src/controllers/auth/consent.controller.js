
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import prisma from "../../config/prisma.js";

const VALID_VERSIONS = ["1.0", "1.1", "1.2"];

// ─────────────────────────────────────────────
//  POST /api/v2/consent
// ─────────────────────────────────────────────
export const saveConsent = asyncHandler(async (req, res, next) => {
  const { sessionId, analytics, marketing, policyVersion } = req.body;

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length < 8)
    return next(new AppError("Valid sessionId is required", 400));

  if (policyVersion && !VALID_VERSIONS.includes(policyVersion))
    return next(new AppError("Invalid policy version", 400));

  const version = policyVersion || "1.0";

  // ✅ Fixed: composite unique key (sessionId + policyVersion)
  const consent = await prisma.consent.upsert({
    where: {
      sessionId_policyVersion: {
        sessionId,
        policyVersion: version,
      },
    },
    update: {
      userId: req.user?.id || null,
      analytics: analytics ?? false,
      marketing: marketing ?? false,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      consentGivenAt: new Date(),
    },
    create: {
      sessionId,
      userId: req.user?.id || null,
      analytics: analytics ?? false,
      marketing: marketing ?? false,
      policyVersion: version,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      consentGivenAt: new Date(),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Consent saved successfully",
    data: {
      sessionId: consent.sessionId,
      analytics: consent.analytics,
      marketing: consent.marketing,
      policyVersion: consent.policyVersion,
      savedAt: consent.updatedAt,
    },
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/consent/:sessionId
// ─────────────────────────────────────────────
export const getConsent = asyncHandler(async (req, res, next) => {
  const { sessionId } = req.params;

  // ✅ Fixed: sessionId alone nahi, latest version dhundho
  const consent = await prisma.consent.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: {
      analytics: true,
      marketing: true,
      policyVersion: true,
      updatedAt: true,
    },
  });

  if (!consent) {
    return res.status(404).json({
      success: false,
      message: "No consent record found",
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      analytics: consent.analytics,
      marketing: consent.marketing,
      policyVersion: consent.policyVersion,
      savedAt: consent.updatedAt,
    },
  });
});