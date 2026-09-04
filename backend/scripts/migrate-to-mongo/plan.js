import { oid, oidOrNull, oidOf } from "./ids.js";

// ── THE MIGRATION PLAN ───────────────────────────────────────────────────
//
// One entry per Postgres table that holds production data. Each entry is an
// EXPLICIT field mapping — nothing is copied by spreading the source row,
// because a spread would silently carry a renamed or retyped column through
// unchanged and mongoose would drop it without a word. Everything the
// destination should hold is named here.
//
// Entry shape:
//   source      Prisma delegate name (prisma[source])
//   model       Mongo model name (models[model])
//   map(row)    → the destination document, or null to SKIP the row
//   note        why this collection needs anything beyond a copy
//
// `passthrough` fields are listed for the reader's benefit: they exist under
// the same name and type on both sides. The mapper still writes them
// explicitly.

/** Prisma Json/Json[] arrive as plain JS values already; null stays null. */
const json = (v) => (v === undefined ? null : v);

/** Preserve a nullable date exactly. Never defaults to now(). */
const date = (v) => (v ? new Date(v) : null);

/**
 * Postgres `Json?` avatar/coverPhoto blobs → the Mongo `mediaSchema`
 * subdocument. Shape is `{ url, publicId?, type? }` on both sides; anything
 * without a url is dropped, because mediaSchema requires it and a
 * half-populated media object would fail validation for the whole user.
 */
const media = (v) => {
  if (!v || typeof v !== "object" || !v.url) return undefined;
  return { url: v.url, publicId: v.publicId ?? undefined, type: v.type ?? "image" };
};

export const PLAN = [
  // ── Identity ───────────────────────────────────────────────────────────
  {
    source: "user",
    model: "User",
    note:
      "The users/profiles split was retired, so every Postgres User column " +
      "lands on `users` under its own name. Two transforms: `password` is " +
      "called `passwordHash` here, and `activeSuspension` is a Json blob on " +
      "Postgres but a typed `{ reason, expiresAt }` subdocument on Mongo.",
    map: (r) => ({
      _id: oid(r.id),
      username: r.username ?? undefined,
      email: r.email ?? undefined,
      phoneNumber: r.phoneNumber ?? undefined,
      // RENAME. Carried across verbatim — it is already a bcrypt hash, and
      // rehashing would invalidate every existing password.
      passwordHash: r.password ?? undefined,
      firebaseUid: r.firebaseUid ?? undefined,
      authProvider: r.authProvider,

      isEmailVerified: r.isEmailVerified,
      isMobileVerified: r.isMobileVerified,
      accountStatus: r.accountStatus,
      // Postgres String → Mongo String. Was an embedded { roleId, roleKey }
      // until Phase 7 consolidated it; the string IS the field now, so this
      // is a straight copy and no lookup into `roles` is required.
      role: r.role,

      fullName: r.fullName,
      avatar: media(r.avatar),
      coverPhoto: media(r.coverPhoto),
      bio: r.bio ?? "",
      designation: r.designation ?? "",
      website: r.website ?? "",
      gender: r.gender ?? "prefer_not_to_say",
      dateOfBirth: date(r.dateOfBirth),
      businessCategory: r.businessCategory ?? undefined,
      location: json(r.location),

      isPrivate: r.isPrivate,
      isVerifiedBadge: r.isVerifiedBadge,

      // Counters are COPIED, never recomputed — see README, "Counters".
      followersCount: r.followersCount,
      followingCount: r.followingCount,
      postsCount: r.postsCount,

      isOnboardingComplete: r.isOnboardingComplete,
      onboardingStep: r.onboardingStep,
      notificationsEnabled: r.notificationsEnabled,
      language: r.language,

      // Json? → typed subdocument. `null` stays absent rather than becoming
      // an empty object, so "never suspended" reads the same on both sides.
      activeSuspension: r.activeSuspension
        ? {
            reason: r.activeSuspension.reason ?? undefined,
            expiresAt: date(r.activeSuspension.expiresAt) ?? undefined,
          }
        : undefined,

      deactivatedAt: date(r.deactivatedAt),
      lastActiveAt: date(r.lastActiveAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "refreshToken",
    model: "Session",
    note:
      "RENAMED COLLECTION (RefreshToken → sessions). Field-for-field " +
      "otherwise. tokenHash is carried verbatim so existing refresh tokens " +
      "keep working across the cutover — see README, 'Session semantics'.",
    map: (r) => ({
      _id: oid(r.id),
      userId: oid(r.userId),
      tokenHash: r.tokenHash,
      deviceInfo: r.deviceInfo,
      ipAddress: r.ipAddress ?? undefined,
      isTrusted: r.isTrusted,
      lastUsedAt: date(r.lastUsedAt),
      expiresAt: new Date(r.expiresAt),
      createdAt: new Date(r.createdAt),
    }),
  },

  {
    source: "suspensionHistory",
    model: "SuspensionHistory",
    note:
      "`performedBy` is a plain String on Postgres but an ObjectId ref on " +
      "Mongo. It holds an admin user id, so it maps through oid() like any " +
      "other FK — rows whose value is not a real user id are reported as " +
      "relationship failures by the validator rather than dropped here.",
    map: (r) => ({
      _id: oid(r.id),
      userId: oid(r.userId),
      action: r.action,
      reason: r.reason ?? undefined,
      duration: r.duration ?? undefined,
      expiresAt: date(r.expiresAt),
      performedBy: oidOrNull(r.performedBy) ?? undefined,
      createdAt: new Date(r.createdAt),
    }),
  },

  // ── Social ─────────────────────────────────────────────────────────────
  {
    source: "post",
    model: "SocialPost",
    note:
      "RENAMED COLLECTION (Post → socialposts). `location` is the Json blob " +
      "the app writes; the schema's `locationId` points at the greenfield " +
      "`locations` collection and stays unset.",
    map: (r) => ({
      _id: oid(r.id),
      authorId: oid(r.authorId),
      type: r.type,
      caption: r.caption ?? "",
      hashtags: r.hashtags ?? [],
      mentions: r.mentions ?? [],
      // Array ORDER is preserved: media order is the carousel order.
      media: (r.media ?? []).map(media).filter(Boolean),
      taggedUsers: (r.taggedUsers ?? []).map((t) => ({
        userId: oidOrNull(t.userId) ?? undefined,
        x: t.x,
        y: t.y,
      })),
      location: json(r.location),
      visibility: r.visibility,
      likesCount: r.likesCount,
      commentsCount: r.commentsCount,
      sharesCount: r.sharesCount,
      savedCount: r.savedCount,
      viewsCount: r.viewsCount,
      commentsDisabled: r.commentsDisabled,
      likesHidden: r.likesHidden,
      isDraft: r.isDraft,
      isDeleted: r.isDeleted,
      deletedAt: date(r.deletedAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "comment",
    model: "Comment",
    map: (r) => ({
      _id: oid(r.id),
      postId: oid(r.postId),
      authorId: oid(r.authorId),
      content: r.content,
      depth: r.depth,
      mentions: r.mentions ?? [],
      parentCommentId: oidOrNull(r.parentCommentId) ?? undefined,
      rootCommentId: oidOrNull(r.rootCommentId) ?? undefined,
      likesCount: r.likesCount,
      repliesCount: r.repliesCount,
      isPinned: r.isPinned,
      status: r.status,
      deletedContent: r.deletedContent ?? undefined,
      moderationReason: r.moderationReason ?? undefined,
      moderatedAt: date(r.moderatedAt),
      moderatedBy: oidOrNull(r.moderatedBy) ?? undefined,
      deletedBy: oidOrNull(r.deletedBy) ?? undefined,
      isDeleted: r.isDeleted,
      deletedAt: date(r.deletedAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "like",
    model: "Like",
    note:
      "POLYMORPHIC COLLAPSE. Postgres carries `targetModel` plus three " +
      "nullable FKs (postId/commentId/storyId); Mongo carries one " +
      "`targetType` + `targetId` pair. targetModel is capitalised on " +
      "Postgres ('Post') and lower-case in LIKE_TARGET_TYPE ('post'). A row " +
      "whose declared target has no matching FK is SKIPPED and counted, " +
      "because it cannot be expressed — never guessed at.",
    map: (r) => {
      const targetId = r.postId ?? r.commentId ?? r.storyId ?? null;
      const targetType = String(r.targetModel ?? "").toLowerCase();
      if (!targetId || !["post", "comment", "story"].includes(targetType)) return null;
      return {
        _id: oid(r.id),
        likedById: oid(r.likedById),
        targetType,
        targetId: oid(targetId),
        reaction: r.reaction,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      };
    },
  },

  {
    source: "follow",
    model: "Follow",
    map: (r) => ({
      _id: oid(r.id),
      followerId: oid(r.followerId),
      followingId: oid(r.followingId),
      status: r.status,
      rejectedAt: date(r.rejectedAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "saved",
    model: "Saved",
    map: (r) => ({
      _id: oid(r.id),
      savedById: oid(r.savedById),
      postId: oid(r.postId),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "block",
    model: "Block",
    map: (r) => ({
      _id: oid(r.id),
      blockerId: oid(r.blockerId),
      blockedId: oid(r.blockedId),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "story",
    model: "Story",
    note:
      "isDeleted/deletedAt are copied from Postgres, NOT inferred from " +
      "expiresAt. Expiry and deletion are different states: an expired story " +
      "is still a story its author deleted or did not delete, and " +
      "reactivating a deactivated account restores exactly the stories that " +
      "were hidden. `closeFriends` becomes ObjectIds (it is a user-id list).",
    map: (r) => ({
      _id: oid(r.id),
      authorId: oid(r.authorId),
      type: r.type,
      media: media(r.media),
      textContent: json(r.textContent),
      caption: r.caption ?? "",
      audience: r.audience,
      closeFriends: (r.closeFriends ?? []).map(oid),
      mentions: r.mentions ?? [],
      hashtags: r.hashtags ?? [],
      viewsCount: r.viewsCount,
      reactionsCount: r.reactionsCount,
      linkUrl: r.linkUrl ?? undefined,
      isDeleted: r.isDeleted,
      deletedAt: date(r.deletedAt),
      expiresAt: new Date(r.expiresAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "storyView",
    model: "StoryView",
    map: (r) => ({
      _id: oid(r.id),
      storyId: oid(r.storyId),
      viewerId: oid(r.viewerId),
      reaction: r.reaction ?? undefined,
      reactedAt: date(r.reactedAt),
      repliedViaMessage: r.repliedViaMessage,
      viewedAt: new Date(r.viewedAt),
    }),
  },

  {
    source: "postView",
    model: "PostView",
    map: (r) => ({
      _id: oid(r.id),
      postId: oid(r.postId),
      userId: oidOrNull(r.userId) ?? undefined, // anonymous views keep no user
      sessionId: r.sessionId ?? undefined,
      source: r.source ?? undefined,
      duration: r.duration,
      device: r.device ?? undefined,
      viewedAt: new Date(r.viewedAt),
    }),
  },

  {
    source: "highlight",
    model: "Highlight",
    note:
      "`snapshots` is a Json[] of denormalised story snapshots and is copied " +
      "as-is, ORDER PRESERVED — the app reads snapshots[].storyId and " +
      "snapshots[].id directly. Any `storyId` inside a snapshot is remapped " +
      "to its ObjectId so the reference still resolves. The separate " +
      "HighlightStory join table becomes `storyRefs` (see its own entry).",
    map: (r) => ({
      _id: oid(r.id),
      authorId: oid(r.authorId),
      title: r.title,
      coverImage: r.coverImage ?? undefined,
      coverPublicId: r.coverPublicId ?? undefined,
      snapshots: (r.snapshots ?? []).map((s) =>
        s && typeof s === "object" && s.storyId
          ? { ...s, storyId: String(oid(s.storyId)) }
          : s
      ),
      isDeleted: r.isDeleted,
      deletedAt: date(r.deletedAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  // ── Messaging ──────────────────────────────────────────────────────────
  {
    source: "conversation",
    model: "Conversation",
    note:
      "`lastMessage` Json? → typed subdocument. `participantIds` has no " +
      "Postgres column at all: it is DERIVED from ConversationParticipant " +
      "in a second pass (see derive.js), because findByParticipant() queries " +
      "it and an empty array would hide every thread.",
    map: (r) => ({
      _id: oid(r.id),
      isGroup: r.isGroup,
      groupName: r.groupName ?? undefined,
      groupAvatar: media(r.groupAvatar),
      groupAdminId: oidOrNull(r.groupAdminId) ?? undefined,
      participantsKey: r.participantsKey ?? undefined,
      isActive: r.isActive,
      lastMessage: r.lastMessage
        ? {
            messageId: oidOrNull(r.lastMessage.messageId) ?? undefined,
            text: r.lastMessage.text ?? undefined,
            senderId: oidOrNull(r.lastMessage.senderId) ?? undefined,
            sentAt: date(r.lastMessage.sentAt) ?? undefined,
          }
        : undefined,
      disbandedAt: date(r.disbandedAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "conversationParticipant",
    model: "ConversationParticipant",
    map: (r) => ({
      _id: oid(r.id),
      conversationId: oid(r.conversationId),
      userId: oid(r.userId),
      unreadCount: r.unreadCount,
      isArchived: r.isArchived,
      lastSeenAt: date(r.lastSeenAt),
      clearedAt: date(r.clearedAt),
      isDeleted: r.isDeleted,
      deletedAt: date(r.deletedAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "message",
    model: "Message",
    note:
      "`reactions[].userId` and `replyTo.messageId` are remapped so the " +
      "embedded references still resolve. reactions ORDER is preserved.",
    map: (r) => ({
      _id: oid(r.id),
      conversationId: oid(r.conversationId),
      senderId: oid(r.senderId),
      text: r.text ?? undefined,
      image: media(r.image),
      type: r.type,
      isEdited: r.isEdited,
      editedAt: date(r.editedAt),
      editHistory: r.editHistory ?? [],
      reactions: (r.reactions ?? []).map((x) =>
        x && x.userId ? { ...x, userId: oid(x.userId) } : x
      ),
      replyTo: r.replyTo
        ? {
            ...r.replyTo,
            ...(r.replyTo.messageId ? { messageId: oid(r.replyTo.messageId) } : {}),
          }
        : undefined,
      isDeleted: r.isDeleted,
      deletedAt: date(r.deletedAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "messageReceipt",
    model: "MessageReceipt",
    map: (r) => ({
      _id: oid(r.id),
      messageId: oid(r.messageId),
      conversationId: oid(r.conversationId),
      userId: oid(r.userId),
      seenAt: date(r.seenAt),
      readAt: date(r.readAt),
    }),
  },

  // ── Notifications ──────────────────────────────────────────────────────
  {
    source: "notification",
    model: "Notification",
    note:
      "`refModel` → `refType`. `audience` has no Postgres column and is set " +
      "to 'user' — this table only ever held per-user notifications; the " +
      "admin feed is a separate table, migrated into the same collection " +
      "with audience:'admin' (see the adminNotification entry).",
    map: (r) => ({
      _id: oid(r.id),
      audience: "user",
      receiverId: oid(r.receiverId),
      senderId: oidOrNull(r.senderId) ?? undefined,
      type: r.type,
      refType: r.refModel ?? undefined,
      refId: oidOrNull(r.refId) ?? undefined,
      meta: json(r.meta),
      isRead: r.isRead,
      readAt: date(r.readAt),
      ttlExpiresAt: date(r.ttlExpiresAt),
      isDeleted: r.isDeleted,
      deletedAt: date(r.deletedAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "adminNotification",
    model: "Notification",
    note:
      "TABLE MERGE. Milestone 2 absorbed the admin feed into `notifications` " +
      "behind an `audience` discriminator. These rows carry no receiver — a " +
      "null receiverId with audience:'admin' is the broadcast shape the " +
      "schema documents. The uuid namespace is disjoint from Notification's, " +
      "so the derived _ids cannot collide.",
    map: (r) => ({
      _id: oid(r.id),
      audience: "admin",
      type: r.type,
      label: r.label,
      meta: json(r.meta),
      isRead: r.isRead,
      readAt: date(r.readAt),
      isDeleted: false,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  // ── Moderation / compliance ────────────────────────────────────────────
  {
    source: "report",
    model: "Report",
    note:
      "`targetModel` ('Post'/'Comment'/'User') → `targetType` (lower-case, " +
      "REPORT_TARGET_TYPE). targetId is a uuid string on Postgres and an " +
      "ObjectId here. The three explicit FKs are kept as well, because the " +
      "admin UI populates post/comment/reportedUser by name.",
    map: (r) => {
      const targetType = String(r.targetModel ?? "").toLowerCase();
      if (!["post", "comment", "user", "listing", "company"].includes(targetType)) return null;
      return {
        _id: oid(r.id),
        reportedById: oid(r.reportedById),
        targetType,
        targetId: oid(r.targetId),
        postId: oidOrNull(r.postId) ?? undefined,
        commentId: oidOrNull(r.commentId) ?? undefined,
        reportedUserId: oidOrNull(r.reportedUserId) ?? undefined,
        reason: r.reason,
        description: r.description ?? "",
        status: r.status,
        priority: r.priority,
        actionTaken: r.actionTaken,
        moderatorNote: r.moderatorNote ?? "",
        escalated: r.escalated,
        escalationReason: r.escalationReason ?? undefined,
        escalatedAt: date(r.escalatedAt),
        escalatedById: oidOrNull(r.escalatedById) ?? undefined,
        claimedAt: date(r.claimedAt),
        claimExpiresAt: date(r.claimExpiresAt),
        claimedById: oidOrNull(r.claimedById) ?? undefined,
        reviewedAt: date(r.reviewedAt),
        rejectedAt: date(r.rejectedAt),
        reviewedById: oidOrNull(r.reviewedById) ?? undefined,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      };
    },
  },

  {
    source: "auditLog",
    model: "AuditLog",
    note:
      "`targetId` is a nullable uuid on Postgres and an ObjectId here. It is " +
      "polymorphic (targetType says what it points at), so it is remapped " +
      "through the same derivation as every other id.",
    map: (r) => ({
      _id: oid(r.id),
      performedById: oid(r.performedById),
      performedByName: r.performedByName,
      action: r.action,
      category: r.category ?? undefined,
      targetType: r.targetType ?? undefined,
      targetId: oidOrNull(r.targetId) ?? undefined,
      targetMeta: json(r.targetMeta),
      ipAddress: r.ipAddress ?? undefined,
      userAgent: r.userAgent ?? undefined,
      note: r.note ?? undefined,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "consent",
    model: "Consent",
    map: (r) => ({
      _id: oid(r.id),
      userId: oidOrNull(r.userId) ?? undefined, // guest consents have none
      sessionId: r.sessionId,
      essential: r.essential,
      analytics: r.analytics,
      marketing: r.marketing,
      policyVersion: r.policyVersion,
      ipAddress: r.ipAddress ?? undefined,
      userAgent: r.userAgent ?? undefined,
      consentGivenAt: date(r.consentGivenAt),
      withdrawnAt: date(r.withdrawnAt),
      guestExpiresAt: date(r.guestExpiresAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "oTP",
    model: "Otp",
    note:
      "RENAMED (OTP → otps). hashedOtp is `select: false` on Mongo but is " +
      "still written here — the projection only affects reads. Live OTPs " +
      "survive the cutover; expired ones are reaped by the TTL index.",
    map: (r) => ({
      _id: oid(r.id),
      userId: oid(r.userId),
      purpose: r.purpose,
      hashedOtp: r.hashedOtp,
      attempts: r.attempts,
      resendCount: r.resendCount,
      lastResendAt: date(r.lastResendAt),
      isUsed: r.isUsed,
      expiresAt: new Date(r.expiresAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },

  {
    source: "hashtag",
    model: "Hashtag",
    map: (r) => ({
      _id: oid(r.id),
      name: r.name,
      postsCount: r.postsCount,
      recentPostsCount: r.recentPostsCount,
      trendingScore: r.trendingScore,
      lastUsedAt: date(r.lastUsedAt),
      isBanned: r.isBanned,
      bannedAt: date(r.bannedAt),
      bannedById: oidOrNull(r.bannedById) ?? undefined,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
  },
];

// ── Collections deliberately NOT migrated ────────────────────────────────
export const EXCLUDED = {
  // Postgres tables with no standalone Mongo collection.
  HighlightStory:
    "Join table. Becomes Highlight.storyRefs[] — handled by derive.js, not " +
    "as a collection of its own.",

  // Mongo collections with no Postgres source. These are Milestone 2/4
  // greenfield domains that have never held data; migrating into them would
  // mean inventing rows.
  Profile:
    "Deprecated. Its fields were consolidated onto `users` in Phase 7 and " +
    "nothing reads it — see identity.schemas.js.",
  Company: "Greenfield (Milestone 4). No Postgres table.",
  CompanyMember: "Greenfield. No Postgres table.",
  Role: "Greenfield. `users.role` is a plain string; no lookup needed.",
  Permission: "Greenfield. No Postgres table.",
  Location:
    "Greenfield. Post/User locations stay Json blobs on their own documents, " +
    "matching Postgres.",
  Category: "Greenfield (marketplace). No Postgres table.",
  MarketplaceListing: "Greenfield. No Postgres table.",
  Order: "Greenfield. No Postgres table.",
  Quote: "Greenfield. No Postgres table.",
  Contract: "Greenfield. No Postgres table.",
  Payment: "Greenfield. No Postgres table.",
  VerificationCase: "Greenfield. No Postgres table.",
  VerificationDocument: "Greenfield. No Postgres table.",
};

export { oid, oidOrNull, oidOf };
