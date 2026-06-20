import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Conversation from "../../models/conversation.model.js";
import { ConversationMember } from "../../models/conversation.model.js";
import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isAdmin = (conv, userId) => {
  return conv.groupAdmin?.toString() === userId.toString();
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/conversations/group
//  Body: { groupName, participantIds: [], avatarUrl? }
// ─────────────────────────────────────────────────────────────────────────────
export const createGroupConversation = asyncHandler(async (req, res, next) => {
  const adminId = req.user._id;
  const { groupName, participantIds, avatarUrl } = req.body;

  if (!groupName?.trim())
    return next(new AppError("groupName is required.", 400));

  if (!Array.isArray(participantIds) || participantIds.length < 1)
    return next(
      new AppError("At least one other participant is required.", 400),
    );

  const invalidId = participantIds.find((id) => !mongoose.isValidObjectId(id));
  if (invalidId)
    return next(new AppError(`Invalid participant id: ${invalidId}`, 400));

  // +1 for the admin themselves
  if (participantIds.length + 1 > 500)
    return next(
      new AppError("Group cannot have more than 500 participants.", 400),
    );

  const conversation = await Conversation.createGroup(
    adminId,
    groupName.trim(),
    participantIds,
    avatarUrl || null,
  );

  const populated = await Conversation.findById(conversation._id).populate(
    "participants",
    "username fullName avatar isVerifiedBadge accountStatus",
  );

  res.status(201).json({ success: true, data: populated });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/add
//  Body: { userId }  — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const addGroupMember = asyncHandler(async (req, res, next) => {
  const requesterId = req.user._id;
  const { conversationId } = req.params;
  const { userId } = req.body;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));
  if (!userId || !mongoose.isValidObjectId(userId))
    return next(new AppError("Valid userId is required.", 400));

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));
  if (!isAdmin(conv, requesterId))
    return next(new AppError("Only the group admin can add members.", 403));

  await Conversation.addParticipant(conversationId, userId);

  const updated = await Conversation.findById(conversationId).populate(
    "participants",
    "username fullName avatar isVerifiedBadge accountStatus",
  );

  res.status(200).json({ success: true, data: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/remove
//  Body: { userId }  — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const removeGroupMember = asyncHandler(async (req, res, next) => {
  const requesterId = req.user._id;
  const { conversationId } = req.params;
  const { userId } = req.body;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));
  if (!userId || !mongoose.isValidObjectId(userId))
    return next(new AppError("Valid userId is required.", 400));

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));
  if (!isAdmin(conv, requesterId))
    return next(new AppError("Only the group admin can remove members.", 403));
  if (userId === requesterId.toString())
    return next(
      new AppError("Admin cannot remove themselves — use leave or transfer admin first.", 400),
    );

  await Conversation.removeParticipant(conversationId, userId);

  const updated = await Conversation.findById(conversationId).populate(
    "participants",
    "username fullName avatar isVerifiedBadge accountStatus",
  );

  res.status(200).json({ success: true, data: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/leave
//  Khud group leave karo — kisi ki permission nahi chahiye
// ─────────────────────────────────────────────────────────────────────────────
export const leaveGroup = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { conversationId } = req.params;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));

  const isMember = conv.participants
    .map((p) => p.toString())
    .includes(userId.toString());
  if (!isMember) return next(new AppError("You are not a member of this group.", 403));

  await Conversation.removeParticipant(conversationId, userId);

  res.status(200).json({ success: true, message: "Left the group." });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/rename
//  Body: { groupName?, avatarUrl? }  — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const renameGroup = asyncHandler(async (req, res, next) => {
  const requesterId = req.user._id;
  const { conversationId } = req.params;
  const { groupName, avatarUrl } = req.body;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));
  if (!groupName?.trim() && !avatarUrl)
    return next(new AppError("groupName or avatarUrl is required.", 400));

  const conv = await Conversation.findById(conversationId);
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));
  if (!isAdmin(conv, requesterId))
    return next(new AppError("Only the group admin can update group info.", 403));

  if (groupName?.trim()) conv.groupName = groupName.trim();
  if (avatarUrl) conv.groupAvatar = { url: avatarUrl, publicId: null };

  await conv.save();

  res.status(200).json({
    success: true,
    data: {
      _id: conv._id,
      groupName: conv.groupName,
      groupAvatar: conv.groupAvatar?.url ?? null,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/transfer-admin
//  Body: { newAdminId }  — current admin only
// ─────────────────────────────────────────────────────────────────────────────
export const transferGroupAdmin = asyncHandler(async (req, res, next) => {
  const requesterId = req.user._id;
  const { conversationId } = req.params;
  const { newAdminId } = req.body;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));
  if (!newAdminId || !mongoose.isValidObjectId(newAdminId))
    return next(new AppError("Valid newAdminId is required.", 400));

  try {
    const updated = await Conversation.transferAdmin(
      conversationId,
      requesterId,
      newAdminId,
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return next(new AppError(err.message, 403));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/conversations/group/:conversationId
//  Group disband — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const disbandGroupConversation = asyncHandler(async (req, res, next) => {
  const requesterId = req.user._id;
  const { conversationId } = req.params;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  try {
    await Conversation.disbandGroup(conversationId, requesterId);
    res.status(200).json({ success: true, message: "Group disbanded." });
  } catch (err) {
    return next(new AppError(err.message, 403));
  }
});