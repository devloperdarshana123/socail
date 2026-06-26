

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import prisma from "../../config/prisma.js";

const isValidUUID = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Helper: groupAdmin can come back as a string (id) or an object (relation) —
// always normalize to a plain id before comparing.
const getAdminId = (groupAdmin) =>
  typeof groupAdmin === "object" && groupAdmin !== null
    ? groupAdmin.id
    : groupAdmin;

const memberInclude = {
  members: {
    where: { isDeleted: false },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
          accountStatus: true,
        },
      },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/conversations/group
//  Body: { groupName, participantIds: [], avatarUrl? }
// ─────────────────────────────────────────────────────────────────────────────
export const createGroupConversation = asyncHandler(async (req, res, next) => {
  const adminId = req.user.id;
  const { groupName, participantIds, avatarUrl } = req.body;

  if (!groupName?.trim())
    return next(new AppError("groupName is required.", 400));

  if (!Array.isArray(participantIds) || participantIds.length < 1)
    return next(new AppError("At least one other participant is required.", 400));

  const invalidId = participantIds.find((id) => !isValidUUID(id));
  if (invalidId)
    return next(new AppError(`Invalid participant id: ${invalidId}`, 400));

  if (participantIds.length + 1 > 500)
    return next(new AppError("Group cannot have more than 500 participants.", 400));

  // Check all participants exist
  const users = await prisma.user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true },
  });
  if (users.length !== participantIds.length)
    return next(new AppError("One or more participant IDs do not exist.", 404));

  const allParticipants = [...new Set([adminId, ...participantIds])];

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: true,
      groupName: groupName.trim(),
      groupAdmin: {
        connect: { id: adminId },
      },
      groupAvatar: avatarUrl ? { url: avatarUrl, publicId: null } : null,
      members: {
        create: allParticipants.map((userId) => ({
          userId,
        })),
      },
    },
    include: memberInclude,
  });

  return res.status(201).json({ success: true, data: conversation });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/add
//  Body: { userId }  — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const addGroupMember = asyncHandler(async (req, res, next) => {
  const requesterId = req.user.id;
  const { conversationId } = req.params;
  const { userId } = req.body;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));
  if (!userId || !isValidUUID(userId))
    return next(new AppError("Valid userId is required.", 400));

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, isGroup: true, groupAdmin: true },
  });

  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));
  if (getAdminId(conv.groupAdmin) !== requesterId)
    return next(new AppError("Only the group admin can add members.", 403));

  // Check user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return next(new AppError("User not found.", 404));

  // Check already an active member
  const existing = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId, isDeleted: false },
  });
  if (existing)
    return next(new AppError("User is already a member.", 400));

  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    update: { isDeleted: false },
    create: { conversationId, userId },
  });

  const updated = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: memberInclude,
  });

  return res.status(200).json({ success: true, data: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/remove
//  Body: { userId }  — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const removeGroupMember = asyncHandler(async (req, res, next) => {
  const requesterId = req.user.id;
  const { conversationId } = req.params;
  const { userId } = req.body;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));
  if (!userId || !isValidUUID(userId))
    return next(new AppError("Valid userId is required.", 400));

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, isGroup: true, groupAdmin: true },
  });

  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));
  if (getAdminId(conv.groupAdmin) !== requesterId)
    return next(new AppError("Only the group admin can remove members.", 403));
  if (userId === requesterId)
    return next(new AppError("Admin cannot remove themselves — use leave or transfer admin first.", 400));

  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { isDeleted: true },
  });

  const updated = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: memberInclude,
  });

  return res.status(200).json({ success: true, data: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/leave
// ─────────────────────────────────────────────────────────────────────────────
export const leaveGroup = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { conversationId } = req.params;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      isGroup: true,
      members: {
        where: { isDeleted: false },
        select: { userId: true },
      },
    },
  });

  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));

  const isMember = conv.members.some((m) => m.userId === userId);
  if (!isMember)
    return next(new AppError("You are not a member of this group.", 403));

 await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { isDeleted: true },
  });

  return res.status(200).json({ success: true, message: "Left the group." });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/rename
//  Body: { groupName?, avatarUrl? }  — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const renameGroup = asyncHandler(async (req, res, next) => {
  const requesterId = req.user.id;
  const { conversationId } = req.params;
  const { groupName, avatarUrl } = req.body;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));
  if (!groupName?.trim() && !avatarUrl)
    return next(new AppError("groupName or avatarUrl is required.", 400));

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, isGroup: true, groupAdmin: true },
  });

  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));
  if (getAdminId(conv.groupAdmin) !== requesterId)
    return next(new AppError("Only the group admin can update group info.", 403));

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(groupName?.trim() && { groupName: groupName.trim() }),
      ...(avatarUrl && { groupAvatar: { url: avatarUrl, publicId: null } }),
    },
  });

  return res.status(200).json({
    success: true,
    data: {
      id: updated.id,
      groupName: updated.groupName,
      groupAvatar: updated.groupAvatar?.url ?? null,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/conversations/group/:conversationId/transfer-admin
//  Body: { newAdminId }
// ─────────────────────────────────────────────────────────────────────────────
export const transferGroupAdmin = asyncHandler(async (req, res, next) => {
  const requesterId = req.user.id;
  const { conversationId } = req.params;
  const { newAdminId } = req.body;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));
  if (!newAdminId || !isValidUUID(newAdminId))
    return next(new AppError("Valid newAdminId is required.", 400));

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      isGroup: true,
      groupAdmin: true,
      members: {
        where: { isDeleted: false },
        select: { userId: true },
      },
    },
  });

  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));
  if (getAdminId(conv.groupAdmin) !== requesterId)
    return next(new AppError("Only the group admin can transfer admin rights.", 403));

  const isMember = conv.members.some((m) => m.userId === newAdminId);
  if (!isMember)
    return next(new AppError("New admin must be a member of the group.", 400));

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      groupAdmin: { connect: { id: newAdminId } },
    },
    include: memberInclude,
  });

  return res.status(200).json({ success: true, data: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/conversations/group/:conversationId
//  Disband group — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const disbandGroupConversation = asyncHandler(async (req, res, next) => {
  const requesterId = req.user.id;
  const { conversationId } = req.params;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, isGroup: true, groupAdmin: true },
  });

  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!conv.isGroup) return next(new AppError("Not a group conversation.", 400));
  if (getAdminId(conv.groupAdmin) !== requesterId)
    return next(new AppError("Only the group admin can disband the group.", 403));

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isActive: false },
  });

  return res.status(200).json({ success: true, message: "Group disbanded." });
});