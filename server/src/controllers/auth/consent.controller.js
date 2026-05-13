import Consent from "../../models/consent.model.js";
import  asyncHandler  from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

// POST /api/v2/consent
export const saveConsent = asyncHandler(async (req, res) => {
  const { sessionId, analytics, marketing, policyVersion } = req.body;

  if (!sessionId) {
    throw new AppError("SessionId is required", 400);
  }

  const consent = await Consent.findOneAndUpdate(
    { sessionId },
    {
      userId: req.user?._id || null,
      sessionId,
      analytics: analytics ?? false,
      marketing: marketing ?? false,
      policyVersion: policyVersion || "1.0",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
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

// GET /api/v2/consent/:sessionId
export const getConsent = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const consent = await Consent.findOne({ sessionId });

  if (!consent) {
    return res.status(404).json({
      success: false,
      message: "No consent record found",
    });
  }

  res.status(200).json({
    success: true,
    data: {
      analytics: consent.analytics,
      marketing: consent.marketing,
      policyVersion: consent.policyVersion,
      savedAt: consent.updatedAt,
    },
  });
});