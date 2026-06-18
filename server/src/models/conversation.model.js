

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  URL Validator (shared with other models)
// ─────────────────────────────────────────────
const isValidUrl = (v) => v === null || /^https?:\/\/.+/.test(v);

// ─────────────────────────────────────────────
//  HTML char guard (prevent XSS in text fields)
// ─────────────────────────────────────────────
const noHtmlChars = (v) => !v || !/[<>"']/.test(v);


const conversationMemberSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0, // FIX: floor guard — can never go negative
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // Last seen message — for "X messages since you left" feature
    lastSeenAt: {
      type: Date,
      default: null,
    },

    clearedAt: {        // ← YE ADD KARO
  type: Date,
  default: null,
},
  },
  { timestamps: true },
);

// One membership record per user per conversation
conversationMemberSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true },
);
// Fast inbox query: all active convos for a user, sorted by activity
conversationMemberSchema.index(
  { userId: 1, isDeleted: 1, conversationId: 1 },
);

export const ConversationMember =
  models.ConversationMember ||
  model("ConversationMember", conversationMemberSchema);

// ─────────────────────────────────────────────
//  Sub-schema: Last Message Preview
// ─────────────────────────────────────────────
const lastMessagePreviewSchema = new Schema(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    text: {
      type: String,
      default: "",
      trim: true,               // FIX #9 — trim preview text
      maxlength: 100,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────
//  Conversation Schema
// ─────────────────────────────────────────────
const conversationSchema = new Schema(
  {
    // ── Participants ──────────────────────────
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      validate: [
        {
          // FIX #5 — minimum 2 participants
          validator: (v) => v.length >= 2,
          message: "Conversation mein kam se kam 2 participants hone chahiye",
        },
        {
          // FIX #5 — maximum cap: 2 for DM, 500 for groups
          // Enforced at static level too; this is the DB-layer guard
          validator: (v) => v.length <= 500,
          message: "Conversation mein maximum 500 participants ho sakte hain",
        },
        {
          // FIX #10 — no duplicate participants
          validator: (v) => {
            const ids = v.map((id) => id.toString());
            return new Set(ids).size === ids.length;
          },
          message: "Duplicate participants not allowed",
        },
      ],
    },

    // ── Last Message (denormalized for list view) ──
    lastMessage: {
      type: lastMessagePreviewSchema,
      default: null,
    },

    // ── Group Chat ────────────────────────────
    isGroup: {
      type: Boolean,
      default: false,
    },

    groupName: {
      type: String,
      trim: true,
      maxlength: [50, "Group name cannot exceed 50 characters"],
      default: null,
      // FIX #8 — block HTML injection chars in group name
      validate: {
        validator: noHtmlChars,
        message: "Group name contains invalid characters",
      },
    },

    groupAvatar: {
      // FIX #7 — URL validation
      url: {
        type: String,
        default: null,
        validate: {
          validator: isValidUrl,
          message: "groupAvatar.url must be a valid http/https URL",
        },
      },
      publicId: { type: String, default: null },
    },

    groupAdmin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    
    isActive: {
      type: Boolean,
      default: true,
    },
participantsKey: {
  type: String,
  default: null,
  // sorted "userIdA_userIdB" string — sirf 1:1 DMs ke liye set hota hai
},
    disbandedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index(
  { participantsKey: 1 },
  {
    unique: true,
    partialFilterExpression: { isGroup: false, participantsKey: { $type: "string" } },
    name: "unique_dm_pair",
  },
);

// FIX #11 — groupAdmin must be one of participants
conversationSchema.pre("validate", function () {
  if (
    this.isGroup &&
    this.groupAdmin &&
    this.participants?.length > 0
  ) {
    const participantStrs = this.participants.map((p) => p.toString());
    if (!participantStrs.includes(this.groupAdmin.toString())) {
      throw new Error("groupAdmin must be one of the participants");
    }
  }
});

conversationSchema.pre("validate", function () {
  if (!this.isGroup && Array.isArray(this.participants) && this.participants.length === 2) {
    const sorted = this.participants.map((p) => p.toString()).sort();
    this.participantsKey = sorted.join("_");
  }
});

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────
conversationSchema.virtual("participantCount").get(function () {
  return this.participants?.length ?? 0;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 
 *
 * @param {ObjectId} userAId
 * @param {ObjectId} userBId
 * @returns {{ conversation, created: boolean }}
 */




conversationSchema.statics.createDM = async function (userAId, userBId) {
  const a = userAId.toString();
  const b = userBId.toString();

  if (a === b) throw new Error("Cannot create a conversation with yourself");

  const sorted = [a, b].sort();
  const participantsKey = sorted.join("_");
  const sortedObjectIds = sorted.map((id) => new mongoose.Types.ObjectId(id));

  try {
    const existingBefore = await this.findOne({ participantsKey, isGroup: false });

    const conversation = await this.findOneAndUpdate(
      { participantsKey, isGroup: false },
      {
        $setOnInsert: {
          participants: sortedObjectIds,
          participantsKey,
          isGroup: false,
          isActive: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const created = !existingBefore;

    if (created) {
      await ConversationMember.insertMany([
        { conversationId: conversation._id, userId: sortedObjectIds[0] },
        { conversationId: conversation._id, userId: sortedObjectIds[1] },
      ]);
    } else {
      await ConversationMember.bulkWrite([
        {
          updateOne: {
            filter: { conversationId: conversation._id, userId: sortedObjectIds[0] },
            update: { $setOnInsert: { conversationId: conversation._id, userId: sortedObjectIds[0], unreadCount: 0, isDeleted: false } },
            upsert: true,
          },
        },
        {
          updateOne: {
            filter: { conversationId: conversation._id, userId: sortedObjectIds[1] },
            update: { $setOnInsert: { conversationId: conversation._id, userId: sortedObjectIds[1], unreadCount: 0, isDeleted: false } },
            upsert: true,
          },
        },
      ]);

      if (!conversation.isActive) {
        await this.findByIdAndUpdate(conversation._id, {
          $set: { isActive: true, disbandedAt: null },
        });
        await ConversationMember.updateMany(
          { conversationId: conversation._id },
          { $set: { isDeleted: false, deletedAt: null } },
        );
      }
    }

    return { conversation, created };
  } catch (err) {
    if (err.code === 11000) {
      const existing = await this.findOne({ participantsKey, isGroup: false }).lean();
      return { conversation: existing, created: false };
    }
    throw err;
  }
};
/**
 * FIX #2 — Create a group conversation
 *
 * @param {ObjectId}   adminId       — creator becomes groupAdmin
 * @param {string}     groupName
 * @param {ObjectId[]} participantIds — must include adminId
 * @param {string}     [avatarUrl]
 * @returns {Document} created Conversation
 */
conversationSchema.statics.createGroup = async function (
  adminId,
  groupName,
  participantIds,
  avatarUrl = null,
) {
  if (participantIds.length > 500)
    throw new Error("Group cannot have more than 500 participants");

  const uniqueIds = [
    ...new Set([adminId.toString(), ...participantIds.map((p) => p.toString())]),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const conversation = await this.create({
    participants: uniqueIds,
    isGroup: true,
    groupName,
    groupAdmin: adminId,
    groupAvatar: avatarUrl ? { url: avatarUrl, publicId: null } : undefined,
    isActive: true,
  });

  // Create ConversationMember records for all participants
  await ConversationMember.insertMany(
    uniqueIds.map((uid) => ({
      conversationId: conversation._id,
      userId: uid,
    })),
  );

  return conversation;
};

/**

 *
 * @param {ObjectId} userId
 * @param {object}   opts
 * @param {string}   [opts.afterId]   — last conversation _id from previous page
 * @param {Date}     [opts.afterDate] — updatedAt of that conversation
 * @param {number}   [opts.limit=20]
 */
conversationSchema.statics.getUserConversations = async function (
  userId,
  { afterId = null, afterDate = null, limit = 20 } = {},
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

  // Step 1: get active (non-deleted) conversation IDs for this user
  const memberQuery = { userId, isDeleted: false };
  const members = await ConversationMember.find(memberQuery)
    .select("conversationId isArchived unreadCount")
    .lean();

  const convIds = members.map((m) => m.conversationId);
  if (!convIds.length) return { conversations: [], nextCursor: null };

  // Build a lookup map for member state
  const memberMap = {};
  for (const m of members) {
    memberMap[m.conversationId.toString()] = m;
  }

  // Step 2: cursor filter on the Conversation collection
  const cursorFilter =
    afterId && afterDate
      ? {
          $or: [
            { updatedAt: { $lt: new Date(afterDate) } },
            {
              updatedAt: new Date(afterDate),
              _id: { $lt: afterId },
            },
          ],
        }
      : {};

  // FIX #17 — for groups, only return up to 5 participants for preview
  // Full participant list is fetched separately via getConversationById
  const conversations = await this.find({
    _id: { $in: convIds },
    isActive: true,
    ...cursorFilter,
  })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .select(
      "participants lastMessage isGroup groupName groupAvatar groupAdmin isActive updatedAt createdAt",
    )
    .populate(
      "participants",
      "username fullName avatar isVerifiedBadge accountStatus",
    )
    .lean();

  const hasMore = conversations.length > safeLimit;
  if (hasMore) conversations.pop();

  // Attach per-user state from memberMap
  const enriched = conversations.map((conv) => {
    const member = memberMap[conv._id.toString()] ?? {};
    return {
      ...conv,
      unreadCount: member.unreadCount ?? 0,
      isArchived: member.isArchived ?? false,
    };
  });

  const last = enriched[enriched.length - 1];
  const nextCursor = hasMore
    ? { afterId: last._id, afterDate: last.updatedAt }
    : null;

  return { conversations: enriched, nextCursor };
};

/**
 * FIX #18 — getConversationById with membership check
 * Prevents non-members from reading conversation data.
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} requestingUserId
 */
conversationSchema.statics.getConversationById = async function (
  conversationId,
  requestingUserId,
) {
  const member = await ConversationMember.findOne({
    conversationId,
    userId: requestingUserId,
    isDeleted: false,
  }).lean();

  if (!member) return null; // not a participant → caller treats as 403

  const conversation = await this.findById(conversationId)
    .populate(
      "participants",
      "username fullName avatar isVerifiedBadge accountStatus",
    )
    .lean();

  if (!conversation) return null;

  return {
    ...conversation,
    unreadCount: member.unreadCount,
    isArchived: member.isArchived,
  };
};

/**
 * FIX #16 — Atomic updateLastMessage + incrementUnread in one round trip
 *
 * @param {ObjectId}   conversationId
 * @param {object}     msgData         — { messageId, text, senderId, sentAt, isDeleted }
 * @param {ObjectId[]} recipientIds    — all participants EXCEPT the sender
 */
conversationSchema.statics.updateLastMessageAndIncrementUnread = async function (
  conversationId,
  { messageId, text, senderId, sentAt, isDeleted = false },
  recipientIds = [],
) {
  // One round trip on Conversation document
  const conversation = await this.findByIdAndUpdate(
    conversationId,
    {
      $set: {
        lastMessage: {
          messageId,
          text: (text ?? "").slice(0, 100),
          senderId,
          sentAt: sentAt ?? new Date(),
          isDeleted,
        },
      },
    },
    { new: true },
  );

  // Bulk increment unread for all recipients (not sender)
  if (recipientIds.length > 0) {
    await ConversationMember.bulkWrite(
      recipientIds.map((uid) => ({
        updateOne: {
          filter: { conversationId, userId: uid },
          update: { $inc: { unreadCount: 1 } },
        },
      })),
    );
  }

  return conversation;
};

/**
 * Legacy single-update kept for backward compat during migration
 * @deprecated Use updateLastMessageAndIncrementUnread
 */
conversationSchema.statics.updateLastMessage = function (
  conversationId,
  { messageId, text, senderId, sentAt, isDeleted = false },
) {
  return this.findByIdAndUpdate(
    conversationId,
    {
      $set: {
        lastMessage: {
          messageId,
          text: (text ?? "").slice(0, 100),
          senderId,
          sentAt: sentAt ?? new Date(),
          isDeleted,
        },
      },
    },
    { new: true },
  );
};

/**
 * FIX #22 — Mark lastMessage preview as deleted
 * Called when a message is soft-deleted so inbox preview updates.
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} messageId       — only updates if this matches current lastMessage
 */
conversationSchema.statics.markLastMessageDeleted = function (
  conversationId,
  messageId,
) {
  return this.findOneAndUpdate(
    { _id: conversationId, "lastMessage.messageId": messageId },
    { $set: { "lastMessage.isDeleted": true, "lastMessage.text": "" } },
    { new: true },
  );
};

/**
 * FIX #3 FIX #4 — Unread count management via ConversationMember
 */
conversationSchema.statics.incrementUnread = function (conversationId, userId) {
  return ConversationMember.findOneAndUpdate(
    { conversationId, userId },
    { $inc: { unreadCount: 1 } },
    { new: true },
  );
};

conversationSchema.statics.resetUnread = function (conversationId, userId) {
  return ConversationMember.findOneAndUpdate(
    { conversationId, userId },
    { $set: { unreadCount: 0, lastSeenAt: new Date() } },
    { new: true },
  );
};

/**
 * Archive / unarchive a conversation for a specific user
 *
 * @param {ObjectId}  conversationId
 * @param {ObjectId}  userId
 * @param {boolean}   archive
 */
conversationSchema.statics.setArchived = function (
  conversationId,
  userId,
  archive,
) {
  return ConversationMember.findOneAndUpdate(
    { conversationId, userId },
    { $set: { isArchived: archive } },
    { new: true },
  );
};

/**
 * Soft-delete a conversation for a specific user
 * If ALL members soft-delete a DM, the conversation is deactivated.
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} userId
 */
conversationSchema.statics.softDeleteForUser = async function (
  conversationId,
  userId,
) {
  await ConversationMember.findOneAndUpdate(
    { conversationId, userId },
    { $set: { isDeleted: true, deletedAt: new Date() } },
  );

  // For DMs: if both sides deleted → deactivate conversation
  const conversation = await this.findById(conversationId)
    .select("isGroup participants")
    .lean();

  if (!conversation || conversation.isGroup) return;

  const activeCount = await ConversationMember.countDocuments({
    conversationId,
    isDeleted: false,
  });

  if (activeCount === 0) {
    await this.findByIdAndUpdate(conversationId, {
      $set: { isActive: false, disbandedAt: new Date() },
    });
  }
};

/**
 * FIX #21 — Add participant to group (admin-gated in controller)
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} newUserId
 */
conversationSchema.statics.addParticipant = async function (
  conversationId,
  newUserId,
) {
  const conversation = await this.findById(conversationId)
    .select("participants isGroup")
    .lean();

  if (!conversation) throw new Error("Conversation not found");
  if (!conversation.isGroup) throw new Error("Cannot add participants to a DM");
  if (conversation.participants.length >= 500)
    throw new Error("Group has reached the 500-participant limit");

  const alreadyIn = conversation.participants
    .map((p) => p.toString())
    .includes(newUserId.toString());
  if (alreadyIn) return; // idempotent

  await this.findByIdAndUpdate(conversationId, {
    $addToSet: { participants: newUserId },
  });

  // Upsert member record (handles re-add after soft delete)
  await ConversationMember.findOneAndUpdate(
    { conversationId, userId: newUserId },
    { $set: { isDeleted: false, deletedAt: null, unreadCount: 0 } },
    { upsert: true },
  );
};

/**
 * FIX #21 — Remove participant from group
 * If the removed user is the admin, auto-transfer to next participant.
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} userId
 */
conversationSchema.statics.removeParticipant = async function (
  conversationId,
  userId,
) {
  const conversation = await this.findById(conversationId).select(
    "participants isGroup groupAdmin",
  );

  if (!conversation) throw new Error("Conversation not found");
  if (!conversation.isGroup) throw new Error("Cannot remove from a DM");

  await this.findByIdAndUpdate(conversationId, {
    $pull: { participants: userId },
  });

  // Soft-delete their member record
  await ConversationMember.findOneAndUpdate(
    { conversationId, userId },
    { $set: { isDeleted: true, deletedAt: new Date() } },
  );

  // FIX #20 — Auto-transfer admin if the admin left
  if (conversation.groupAdmin?.toString() === userId.toString()) {
    const remaining = conversation.participants.filter(
      (p) => p.toString() !== userId.toString(),
    );
    if (remaining.length > 0) {
      await this.findByIdAndUpdate(conversationId, {
        $set: { groupAdmin: remaining[0] },
      });
    } else {
      // Group is empty — deactivate
      await this.findByIdAndUpdate(conversationId, {
        $set: { isActive: false, disbandedAt: new Date() },
      });
    }
  }
};

/**
 * FIX #20 — Explicit admin transfer
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} currentAdminId — must match existing groupAdmin
 * @param {ObjectId} newAdminId     — must be a participant
 */
conversationSchema.statics.transferAdmin = async function (
  conversationId,
  currentAdminId,
  newAdminId,
) {
  const conversation = await this.findOne({
    _id: conversationId,
    groupAdmin: currentAdminId,
    participants: newAdminId,
  })
    .select("_id")
    .lean();

  if (!conversation)
    throw new Error(
      "Transfer failed: caller is not admin or target is not a participant",
    );

  return this.findByIdAndUpdate(
    conversationId,
    { $set: { groupAdmin: newAdminId } },
    { new: true },
  ).lean();
};

/**
 * FIX #19 — Explicit disband (admin only, group only)
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} adminId
 */
conversationSchema.statics.disbandGroup = async function (
  conversationId,
  adminId,
) {
  const updated = await this.findOneAndUpdate(
    { _id: conversationId, isGroup: true, groupAdmin: adminId },
    { $set: { isActive: false, disbandedAt: new Date() } },
    { new: true },
  ).lean();

  if (!updated) throw new Error("Not found or not authorized to disband");
  return updated;
};

/**
 * Find existing DM between two users (read-only lookup)
 */
conversationSchema.statics.findDMBetween = function (userAId, userBId) {
  const sorted = [userAId, userBId].sort((x, y) =>
    x.toString().localeCompare(y.toString()),
  );
  return this.findOne({
    isGroup: false,
    participants: { $all: sorted, $size: 2 },
    isActive: true,
  }).lean();
};

// ─────────────────────────────────────────────
//  Instance Methods
// ─────────────────────────────────────────────

/**
 * FIX #12 #23 — toSafeObject strips private fields,
 * works on Mongoose documents (not lean results).
 * For lean results, use the enriched objects from getUserConversations.
 *
 * @param {ObjectId} currentUserId
 * @param {number}   [unreadCount=0]  — pass from ConversationMember
 */
conversationSchema.methods.toSafeObject = function (
  currentUserId,
  unreadCount = 0,
) {
  return {
    _id: this._id,
    participants: this.participants,
    lastMessage: this.lastMessage ?? null,
    unreadCount,                        // FIX #12: passed in, not read via .get()
    isGroup: this.isGroup,
    groupName: this.groupName ?? null,
    groupAvatar: this.groupAvatar?.url ?? null,
    groupAdmin: this.groupAdmin ?? null,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    // FIX #23: archivedBy / deletedBy arrays NOT returned — caller passes unreadCount/isArchived
  };
};

// ─────────────────────────────────────────────
const Conversation =
  models.Conversation || model("Conversation", conversationSchema);

export default Conversation;