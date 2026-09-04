import { transactionRunner } from "../config/transaction.js";
import {
  conversationRepository,
  conversationParticipantRepository,
  messageRepository,
  messageReceiptRepository,
  userRepository,
} from "../config/repositories.js";
import { encryptMessage, decryptMessage } from "./encryption.js";

// Persistence for the message/conversation domain now flows through the
// repository layer (Phase 7A) instead of the Prisma client directly.
// Database/behavior are unchanged — every query below is the same shape as
// the prisma.* call it replaces; only the access path moved.
//
// ── CONCURRENCY MECHANISMS: TRANSLATED, NOT REDESIGNED ──────────────────
// reactToMessage's three mechanisms are preserved exactly as found:
//
//   1. SELECT ... FOR UPDATE — moved verbatim into
//      messageRepository.findByIdForUpdate(). Prisma cannot express FOR
//      UPDATE through the ORM, so this is genuinely load-bearing raw SQL.
//      It is passed `{ tx }` because a row lock only lives for the life of
//      its transaction; without one the lock would be released before the
//      caller could use it.
//   2. The callback transaction now runs through transactionRunner.run(),
//      so the read-modify-write stays inside one transaction and the lock
//      is held across both statements.
//   3. The 3-attempt retry loop with backoff stays HERE — it is concurrency
//      policy, not persistence, and it depends on TransactionError
//      preserving the original err.message so its two fail-fast guard
//      checks still match.
//
// Phase 6I suggested this could eventually become a Mongo findOneAndUpdate;
// that is deliberately NOT done here. Phase 7A is Postgres-only and
// behaviour-preserving, so the locking semantics are translated as-is.
//
// Nested writes (members.create, groupAdmin.connect) also pass through
// verbatim — the repositories forward `data` untouched, so group creation
// stays atomic via Prisma's implicit nested-write transaction, and the
// add-member guard→upsert sequence stays intentionally non-atomic with the
// idempotent upsert as its real protection.

// ── Sync lastMessage preview ────────────────────────────────────────────
export const syncLastMessage = async (conversationId, msg) => {
  await conversationRepository.update(conversationId, {
    lastMessage: {
      messageId: msg.id,
      text: msg.isDeleted ? "" : encryptMessage((msg.text ?? "").slice(0, 100)),
      senderId: msg.senderId,
      sentAt: msg.createdAt,
      isDeleted: msg.isDeleted ?? false,
    },
  });
};

// ── Get conversations list ──────────────────────────────────────────────
export const getConversationsList = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const members = await conversationParticipantRepository.findAllActiveByUserId(userId, {
    select: { conversationId: true, unreadCount: true },
  });

  const convIds = members.map((m) => m.conversationId);
  const memberMap = new Map(members.map((m) => [m.conversationId, m]));

  const conversations = await conversationRepository.findActiveByIds(convIds, {
    skip,
    take: limit + 1,
    include: includeMembers,
  });

  const hasMore = conversations.length > limit;
  const items = hasMore ? conversations.slice(0, limit) : conversations;

  const formatted = items.map((conv) => ({
    ...conv,
    unreadCount: memberMap.get(conv.id)?.unreadCount ?? 0,
    participants: conv.members.map((m) => m.user),
  }));

  return { conversations: formatted, hasMore };
};

// ── Get or create DM ────────────────────────────────────────────────────
// export const getOrCreateDM = async (userId, participantId) => {
//   const existing = await prisma.conversation.findFirst({
//     where: {
//       isGroup: false,
//       isActive: true,
//       AND: [
//         { members: { some: { userId, isDeleted: false } } },
//         { members: { some: { userId: participantId, isDeleted: false } } },
//       ],
//     },
//     include: {
//       members: {
//         where: { isDeleted: false },
//         include: {
//           user: {
//             select: {
//               id: true,
//               username: true,
//               fullName: true,
//               avatar: true,
//               isVerifiedBadge: true,
//               accountStatus: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   if (existing) {
//     return {
//       ...existing,
//       participants: existing.members.map((m) => m.user),
//     };
//   }

//   // Create new DM
//   const conversation = await prisma.conversation.create({
//     data: {
//       isGroup: false,
//       members: {
//         create: [
//           { userId },
//           { userId: participantId },
//         ],
//       },
//     },
//     include: {
//       members: {
//         where: { isDeleted: false },
//         include: {
//           user: {
//             select: {
//               id: true,
//               username: true,
//               fullName: true,
//               avatar: true,
//               isVerifiedBadge: true,
//               accountStatus: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   return {
//     ...conversation,
//     participants: conversation.members.map((m) => m.user),
//   };
// };
// ── Get or create DM ────────────────────────────────────────────────────
const includeMembers = {
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

// The sender projection attached to created/listed messages.
const MESSAGE_SENDER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  isVerifiedBadge: true,
};

export const getOrCreateDM = async (userId, participantId) => {
  // Consistent key regardless of who initiates
  const key = [userId, participantId].sort().join(":");

  try {
    const conversation = await conversationRepository.create(
      {
        isGroup: false,
        participantsKey: key,
        members: {
          create: [
            { userId },
            { userId: participantId },
          ],
        },
      },
      { include: includeMembers }
    );

    return {
      ...conversation,
      participants: conversation.members.map((m) => m.user),
    };
  } catch (err) {
    if (err.code === "P2002") {
      // Already exists — someone else's request won the race, fetch it
      const existing = await conversationRepository.findByParticipantsKey(key, {
        include: includeMembers,
      });

      if (existing) {
        return {
          ...existing,
          participants: existing.members.map((m) => m.user),
        };
      }
    }
    throw err;
  }
};
// ── Get total unread count ──────────────────────────────────────────────
export const getTotalUnread = async (userId) => {
  const result = await conversationParticipantRepository.sumUnreadForUser(userId);

  return result.unreadCount ?? 0;
};

// ── Mark conversation read ──────────────────────────────────────────────
export const markConversationRead = async (conversationId, userId) => {
  // Reset unread counter
  await conversationParticipantRepository.updateManyWhere(
    { conversationId, userId },
    { unreadCount: 0, lastSeenAt: new Date() }
  );

  // Mark all messages as seen via MessageReceipt
  const unreadMessages = await messageRepository.findAllByConversationId(conversationId, {
    select: { id: true },
  });

  await Promise.all(
    unreadMessages.map((msg) =>
      messageReceiptRepository.upsertByMessageAndUser(msg.id, userId, {
        update: { seenAt: new Date() },
        create: {
          messageId: msg.id,
          userId,
          conversationId,
          seenAt: new Date(),
        },
      })
    )
  );
};

// ── Soft delete conversation for user ───────────────────────────────────
export const softDeleteConversationForUser = async (conversationId, userId) => {
  await conversationParticipantRepository.updateManyWhere(
    { conversationId, userId },
    { isDeleted: true, deletedAt: new Date() }
  );
};

// ── Get messages (cursor-paginated) ────────────────────────────────────
export const getMessages = async (conversationId, userId, { limit = 30, before = null } = {}) => {
  const member = await conversationParticipantRepository.findByConversationAndUser(
    conversationId,
    userId,
    { select: { clearedAt: true } }
  );

  const where = {
    conversationId,
    isDeleted: false,
    ...(member?.clearedAt && { createdAt: { gt: member.clearedAt } }),
  };

  if (before) {
    const cursorMsg = await messageRepository.findById(before, {
      select: { createdAt: true },
    });
    if (cursorMsg) {
      where.createdAt = {
        ...where.createdAt,
        lt: cursorMsg.createdAt,
      };
    }
  }

  const messages = await messageRepository.findManyWithCursor(where, {
    take: limit + 1,
    include: { sender: { select: MESSAGE_SENDER_SELECT } },
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;

  items.reverse();

  const decrypted = items.map((msg) => ({
    ...msg,
    text: msg.text ? decryptMessage(msg.text) : "",
  }));

  return {
    messages: decrypted,
    hasMore,
    nextCursor: hasMore ? items[0]?.id : null,
  };
};

// ── Send message ────────────────────────────────────────────────────────
export const createMessage = async (conversationId, senderId, { text, image, replyTo } = {}) => {
  let replyPreview = null;
  if (replyTo) {
    const parent = await messageRepository.findById(replyTo, {
      select: {
        id: true,
        text: true,
        image: true,
        isDeleted: true,
        senderId: true,
      },
    });

    if (parent) {
      replyPreview = {
        messageId: parent.id,
        text: parent.isDeleted ? "" : (parent.text?.slice(0, 100) ?? ""),
        senderId: parent.senderId,
        isDeleted: parent.isDeleted ?? false,
      };
    }
  }

  const msg = await messageRepository.create(
    {
      conversationId,
      senderId,
      text: text?.trim() ? encryptMessage(text.trim()) : "",
      image: image || null,
      replyTo: replyPreview || undefined,
      type: image && !text?.trim() ? "image" : "text",
    },
    { include: { sender: { select: MESSAGE_SENDER_SELECT } } }
  );

  return msg;
};

// ── Increment unread for recipients ────────────────────────────────────
export const incrementUnreadForRecipients = async (conversationId, senderId) => {
  await conversationParticipantRepository.updateManyWhere(
    {
      conversationId,
      userId: { not: senderId },
      isDeleted: false,
    },
    { unreadCount: { inc: 1 } }
  );
};

// ── Edit message ────────────────────────────────────────────────────────
export const editMessage = async (messageId, userId, newText) => {
  const msg = await messageRepository.findById(messageId, {
    select: { id: true, senderId: true, isDeleted: true, conversationId: true },
  });

  if (!msg) throw new Error("Message not found");
  if (msg.isDeleted) throw new Error("Cannot edit a deleted message");
  if (String(msg.senderId) !== String(userId)) throw new Error("Unauthorized");

  const updated = await messageRepository.update(messageId, {
    text: encryptMessage(newText.trim()),
    isEdited: true,
    editedAt: new Date(),
  });

  return updated;
};

// ── Soft delete message ─────────────────────────────────────────────────
export const softDeleteMessage = async (messageId, userId) => {
  const msg = await messageRepository.findById(messageId, {
    select: { id: true, senderId: true, isDeleted: true, conversationId: true },
  });

  if (!msg) throw new Error("Message not found");
  if (msg.isDeleted) throw new Error("Message already deleted");
  if (String(msg.senderId) !== String(userId)) throw new Error("Unauthorized");

  // update(), NOT delete() — the repository's delete() applies its own
  // soft-delete payload; this one also blanks text/image/reactions.
  const updated = await messageRepository.update(messageId, {
    isDeleted: true,
    deletedAt: new Date(),
    text: "",
    image: null,
    reactions: [],
  });

  return updated;
};

// ── React to message ────────────────────────────────────────────────────
// export const reactToMessage = async (messageId, userId, emoji) => {
//   const msg = await prisma.message.findUnique({
//     where: { id: messageId },
//     select: { id: true, isDeleted: true, reactions: true, conversationId: true },
//   });

//   if (!msg) throw new Error("Message not found");
//   if (msg.isDeleted) throw new Error("Cannot react to a deleted message");

//   const filtered = (msg.reactions || []).filter((r) => r.userId !== userId);

//   if (emoji?.trim()) {
//     filtered.push({ userId, emoji: emoji.trim(), reactedAt: new Date() });
//   }

//   const updated = await prisma.message.update({
//     where: { id: messageId },
//     data: { reactions: filtered },
//   });

//   return updated;
// };


// ── React to message ────────────────────────────────────────────────────
export const reactToMessage = async (messageId, userId, emoji) => {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await transactionRunner.run(async (tx) => {
        // Row lock — MUST receive `tx`, or the lock is released before the
        // read-modify-write below can rely on it. See the repository method.
        const msg = await messageRepository.findByIdForUpdate(messageId, { tx });

        if (!msg || msg.length === 0) throw new Error("Message not found");
        if (msg[0].isDeleted) throw new Error("Cannot react to a deleted message");

        const currentReactions = msg[0].reactions || [];
        const filtered = currentReactions.filter((r) => String(r.userId) !== String(userId));

        if (emoji?.trim()) {
          filtered.push({ userId, emoji: emoji.trim(), reactedAt: new Date() });
        }

        const updated = await messageRepository.update(
          messageId,
          { reactions: filtered },
          { tx }
        );

        return updated;
      });
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err;
      if (err.message === "Message not found" || err.message === "Cannot react to a deleted message") {
        throw err;
      }
      // Retry on transaction conflict
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
};
// ── Clear chat for user ─────────────────────────────────────────────────
export const clearChatForUser = async (conversationId, userId) => {
  await conversationParticipantRepository.updateManyWhere(
    { conversationId, userId },
    { clearedAt: new Date() }
  );
};

// ── Verify participant ──────────────────────────────────────────────────
export const isParticipant = async (conversationId, userId) => {
  const member = await conversationParticipantRepository.findByConversationAndUser(
    conversationId,
    userId,
    { select: { id: true, isDeleted: true } }
  );

  return !!member && !member.isDeleted;
};

// ── Controller-extracted guards (Milestone 5G) ──────────────────────────
//    Each query below was inline in message.controller.js and is moved
//    here verbatim so the controller performs no direct DB access. Queries
//    are byte-identical to the ones they replace; null is returned for a
//    missing row exactly as Prisma's findUnique does.

// getOrCreateConversation: does this participant user exist?
export const findParticipantById = (userId) => {
  return userRepository.findById(userId, { select: { id: true } });
};

// deleteConversation: does this conversation exist?
export const findConversationExists = (conversationId) => {
  return conversationRepository.findById(conversationId, { select: { id: true } });
};

// reactToMessage: the conversation a message belongs to (for the participant check).
export const getMessageConversationId = (messageId) => {
  return messageRepository.findById(messageId, { select: { conversationId: true } });
};

// ── Group persistence, extracted from group.controller.js (Milestone 5J) ─
//    Every query below was inline in the controller and is moved here
//    verbatim — messageHelpers is the established owner of conversation /
//    participant persistence (conversationHelpers.js was dead code, deleted in Phase 7E, which
//    nothing imports). Queries are byte-identical; the controller keeps ALL
//    orchestration: validation, the getAdminId normalization, authorization
//    branching, and every response/status code.
//
//    Atomicity is preserved exactly as found (see the group characterization
//    test header): group creation is atomic via Prisma's nested write; the
//    add-member guard→upsert sequence stays intentionally non-atomic, with
//    the idempotent upsert as its real protection.

// createGroupConversation: verify every supplied participant id exists.
export const findUsersByIds = (participantIds) => {
  return userRepository.findAllByIds(participantIds, { select: { id: true } });
};

// createGroupConversation: create the group + its member rows in one
// nested (implicitly transactional) write.
//
// M-3 NOTE — `members: { create: [...] }` is a NESTED COMPOSITE WRITE, not a
// field mutation, so it is deliberately outside the neutral mutation DSL and
// passes through untouched. It has no single-document Mongo equivalent: on
// Mongo this becomes two collection writes inside a transaction, which is a
// repository-implementation decision, not something a payload translator can
// express. `groupAdmin: { link }` IS a field-level relation write and is
// translated. Documented here so the asymmetry is deliberate rather than an
// oversight; see queryHelpers/mutation.js.
export const createGroupConversation = ({ groupName, adminId, avatarUrl, allParticipants }) => {
  return conversationRepository.create(
    {
      isGroup: true,
      groupName: groupName.trim(),
      groupAdmin: { link: adminId },
      groupAvatar: avatarUrl ? { url: avatarUrl, publicId: null } : null,
      members: {
        create: allParticipants.map((userId) => ({
          userId,
        })),
      },
    },
    { include: includeMembers }
  );
};

// add / remove / rename / disband: the admin-authorization guard lookup.
export const getGroupForAdminCheck = (conversationId) => {
  return conversationRepository.findById(conversationId, {
    select: { id: true, isGroup: true, groupAdmin: true },
  });
};

// leaveGroup: guard lookup including the active member list.
export const getGroupWithMembers = (conversationId) => {
  return conversationRepository.findById(conversationId, {
    select: {
      id: true,
      isGroup: true,
      members: {
        where: { isDeleted: false },
        select: { userId: true },
      },
    },
  });
};

// transferGroupAdmin: guard lookup including admin AND the active member list.
export const getGroupForAdminTransfer = (conversationId) => {
  return conversationRepository.findById(conversationId, {
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
};

// addGroupMember: is this user already an active member?
export const findActiveGroupMember = (conversationId, userId) => {
  return conversationParticipantRepository.findActiveByConversationAndUser(conversationId, userId);
};

// addGroupMember: idempotent add (re-activates a previously removed member).
export const upsertGroupMember = (conversationId, userId) => {
  return conversationParticipantRepository.upsertByConversationAndUser(conversationId, userId, {
    update: { isDeleted: false },
    create: { conversationId, userId },
  });
};

// removeGroupMember / leaveGroup: soft-delete the participant row.
export const softDeleteGroupMember = (conversationId, userId) => {
  return conversationParticipantRepository.updateManyWhere(
    { conversationId, userId },
    { isDeleted: true }
  );
};

// add / remove member: re-fetch the group with its populated member list.
export const getGroupWithMemberDetails = (conversationId) => {
  return conversationRepository.findById(conversationId, { include: includeMembers });
};

// renameGroup: apply the controller-assembled name/avatar update.
export const updateGroupInfo = (conversationId, data) => {
  return conversationRepository.update(conversationId, data);
};

// transferGroupAdmin: connect the new admin, returning populated members.
export const updateGroupAdmin = (conversationId, newAdminId) => {
  return conversationRepository.update(
    conversationId,
    { groupAdmin: { link: newAdminId } },
    { include: includeMembers }
  );
};

// disbandGroupConversation: soft-disband (members intentionally left in place).
export const deactivateGroupConversation = (conversationId) => {
  return conversationRepository.update(conversationId, { isActive: false });
};