import { Schema } from "mongoose";
import { mediaSchema } from "./subdocuments/index.js";
import {
  timestampsPlugin,
  jsonTransformPlugin,
  softDeletePlugin,
  paginationPlugin,
} from "../plugins/index.js";
import {
  POST_VISIBILITY,
  COMMENT_STATUS,
  LIKE_TARGET_TYPE,
  FOLLOW_STATUS,
  STORY_TYPE,
  STORY_AUDIENCE,
} from "../constants/index.js";
import { applySocialIndexes } from "../indexes/social.indexes.js";

// ─────────────────────────────────────────────
//  socialPosts — from Post. Media/mentions/tags embedded (small, bounded,
//  always read together); comments/likes/etc. stay reference collections
//  (unbounded, queried independently).
// ─────────────────────────────────────────────
export const socialPostSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    caption: { type: String, default: "", maxlength: 2200 },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    mentions: [{ type: String }],
    media: [{ type: mediaSchema }],
    taggedUsers: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        x: { type: Number },
        y: { type: Number },
      },
    ],
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    // The Postgres Json blob the app actually writes and reads —
    // `{ name, coordinates? }`, assembled in postHelpers. `locationId`
    // above points at the greenfield `locations` collection, which no
    // code populates; without this field every post location was
    // silently dropped by strict mode and had nowhere to migrate to.
    location: { type: Schema.Types.Mixed },
    visibility: { type: String, enum: POST_VISIBILITY, default: "public" },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    sharesCount: { type: Number, default: 0, min: 0 },
    savedCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 0, min: 0 },
    commentsDisabled: { type: Boolean, default: false },
    likesHidden: { type: Boolean, default: false },
    isDraft: { type: Boolean, default: false },
  }
);
socialPostSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "postId",
});
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
socialPostSchema.virtual("author", {
  ref: "User",
  localField: "authorId",
  foreignField: "_id",
  justOne: true,
});
socialPostSchema.plugin(timestampsPlugin);
socialPostSchema.plugin(jsonTransformPlugin);
socialPostSchema.plugin(softDeletePlugin); // isDeleted/deletedAt
socialPostSchema.plugin(paginationPlugin);
applySocialIndexes.socialPost(socialPostSchema);

// ─────────────────────────────────────────────
//  comments — self-referential thread. Unbounded, stays a reference
//  collection exactly as Postgres already modeled it.
// ─────────────────────────────────────────────
export const commentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "SocialPost", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 2200 },
    depth: { type: Number, default: 0, min: 0, max: 10 },
    mentions: [{ type: String }],
    parentCommentId: { type: Schema.Types.ObjectId, ref: "Comment" },
    rootCommentId: { type: Schema.Types.ObjectId, ref: "Comment" },
    likesCount: { type: Number, default: 0, min: 0 },
    repliesCount: { type: Number, default: 0, min: 0 },
    isPinned: { type: Boolean, default: false },
    status: { type: String, enum: COMMENT_STATUS, default: "active" },
    deletedContent: { type: String },
    moderationReason: { type: String },
    moderatedAt: { type: Date },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  }
);
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
commentSchema.virtual("author", {
  ref: "User",
  localField: "authorId",
  foreignField: "_id",
  justOne: true,
});
commentSchema.virtual("post", {
  ref: "SocialPost",
  localField: "postId",
  foreignField: "_id",
  justOne: true,
});
commentSchema.plugin(timestampsPlugin);
commentSchema.plugin(jsonTransformPlugin);
commentSchema.plugin(softDeletePlugin);
commentSchema.plugin(paginationPlugin);
applySocialIndexes.comment(commentSchema);

// ─────────────────────────────────────────────
//  likes — one discriminator pair instead of Postgres's three nullable
//  FKs. Note: no `refPath` on targetId — see ../validators/index.js.
// ─────────────────────────────────────────────
export const likeSchema = new Schema(
  {
    likedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: LIKE_TARGET_TYPE, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reaction: { type: String, default: "❤️" },
  }
);
likeSchema.virtual("likedBy", {
  ref: "User",
  localField: "likedById",
  foreignField: "_id",
  justOne: true,
});
likeSchema.plugin(timestampsPlugin);
likeSchema.plugin(jsonTransformPlugin);
applySocialIndexes.like(likeSchema);

// ─────────────────────────────────────────────
//  follows — unbounded graph edge. Never embedded on users (see Phase 2).
// ─────────────────────────────────────────────
export const followSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followingId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: FOLLOW_STATUS, default: "accepted" },
    rejectedAt: { type: Date },
  }
);
followSchema.virtual("follower", {
  ref: "User",
  localField: "followerId",
  foreignField: "_id",
  justOne: true,
});
followSchema.virtual("following", {
  ref: "User",
  localField: "followingId",
  foreignField: "_id",
  justOne: true,
});
followSchema.plugin(timestampsPlugin);
followSchema.plugin(jsonTransformPlugin);
followSchema.pre("validate", function noSelfFollow() {
  if (this.followerId && this.followingId && this.followerId.equals(this.followingId)) {
    throw new Error("followerId and followingId must differ");
  }
});
applySocialIndexes.follow(followSchema);

// ─────────────────────────────────────────────
//  saved — bookmark join, unbounded per active user.
// ─────────────────────────────────────────────
export const savedSchema = new Schema(
  {
    savedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: Schema.Types.ObjectId, ref: "SocialPost", required: true },
  }
);
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
savedSchema.virtual("post", {
  ref: "SocialPost",
  localField: "postId",
  foreignField: "_id",
  justOne: true,
});
savedSchema.virtual("savedBy", {
  ref: "User",
  localField: "savedById",
  foreignField: "_id",
  justOne: true,
});
savedSchema.plugin(timestampsPlugin);
savedSchema.plugin(jsonTransformPlugin);
applySocialIndexes.saved(savedSchema);

// ─────────────────────────────────────────────
//  blocks — checked on nearly every message-send/comment action.
// ─────────────────────────────────────────────
export const blockSchema = new Schema(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blockedId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  }
);
blockSchema.virtual("blocker", {
  ref: "User",
  localField: "blockerId",
  foreignField: "_id",
  justOne: true,
});
blockSchema.virtual("blocked", {
  ref: "User",
  localField: "blockedId",
  foreignField: "_id",
  justOne: true,
});
blockSchema.plugin(timestampsPlugin);
blockSchema.plugin(jsonTransformPlugin);
blockSchema.pre("validate", function noSelfBlock() {
  if (this.blockerId && this.blockedId && this.blockerId.equals(this.blockedId)) {
    throw new Error("blockerId and blockedId must differ");
  }
});
applySocialIndexes.block(blockSchema);

// ─────────────────────────────────────────────
//  stories — 24h ephemeral content. TTL index replaces cron-based expiry.
// ─────────────────────────────────────────────
export const storySchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: STORY_TYPE, default: "media" },
    media: { type: mediaSchema },
    textContent: { type: Schema.Types.Mixed },
    caption: { type: String, default: "", maxlength: 500 },
    audience: { type: String, enum: STORY_AUDIENCE, default: "followers" },
    closeFriends: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mentions: [{ type: String }],
    hashtags: [{ type: String, lowercase: true, trim: true }],
    viewsCount: { type: Number, default: 0, min: 0 },
    reactionsCount: { type: Number, default: 0, min: 0 },
    linkUrl: { type: String },
    expiresAt: { type: Date, required: true },
  }
);
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
storySchema.virtual("author", {
  ref: "User",
  localField: "authorId",
  foreignField: "_id",
  justOne: true,
});
storySchema.plugin(timestampsPlugin);
// The soft-delete pair, matching the Postgres Story model — and matching what
// softDelete.plugin.js's own docstring already claims ("used by socialPosts,
// comments, STORIES, highlights, …"). It was simply never applied here.
//
// The TTL index on expiresAt is not a substitute. Account deactivation hides
// a user's stories with `{ isDeleted: true }` and REACTIVATION RESTORES THEM
// with `{ isDeleted: false }` (settingsHelpers.js:251 and :332). A hard
// delete cannot express that, and without the field mongoose's strict mode
// dropped both writes silently: deactivating left the stories visible, and
// deleting one's own story did nothing at all.
storySchema.plugin(softDeletePlugin);
storySchema.plugin(jsonTransformPlugin);
applySocialIndexes.story(storySchema);

// ─────────────────────────────────────────────
//  storyViews / postViews — high-write analytics events.
// ─────────────────────────────────────────────
export const storyViewSchema = new Schema(
  {
    storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true },
    viewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reaction: { type: String },
    reactedAt: { type: Date },
    repliedViaMessage: { type: Boolean, default: false },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
storyViewSchema.virtual("viewer", {
  ref: "User",
  localField: "viewerId",
  foreignField: "_id",
  justOne: true,
});
storyViewSchema.virtual("story", {
  ref: "Story",
  localField: "storyId",
  foreignField: "_id",
  justOne: true,
});
storyViewSchema.plugin(jsonTransformPlugin);
applySocialIndexes.storyView(storyViewSchema);

export const postViewSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "SocialPost", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    sessionId: { type: String },
    source: { type: String },
    duration: { type: Number, default: 0, min: 0 },
    device: { type: String },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
postViewSchema.plugin(jsonTransformPlugin);
applySocialIndexes.postView(postViewSchema);

// ─────────────────────────────────────────────
//  highlights — HighlightStory absorbed as an embedded array (bounded,
//  always read as one unit — see Phase 2, Group 4).
// ─────────────────────────────────────────────
export const highlightSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 60 },
    coverImage: { type: String },
    coverPublicId: { type: String },
    // The denormalized story snapshots the app maintains — Postgres
    // Json[], holding `{ id, storyId, type, media, … }` per entry.
    // highlightHelpers reads `highlight.snapshots.some(…)` directly, so
    // without this the highlight flow threw on undefined. `storyRefs`
    // below is Milestone 2's reference-only model; nothing reads it.
    snapshots: [{ type: Schema.Types.Mixed }],
    storyRefs: [
      {
        storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  }
);
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
highlightSchema.virtual("author", {
  ref: "User",
  localField: "authorId",
  foreignField: "_id",
  justOne: true,
});
highlightSchema.plugin(timestampsPlugin);
highlightSchema.plugin(jsonTransformPlugin);
highlightSchema.plugin(softDeletePlugin);
applySocialIndexes.highlight(highlightSchema);

// ─────────────────────────────────────────────
//  hashtags — aggregate/trending table, unchanged from Postgres shape.
// ─────────────────────────────────────────────
export const hashtagSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    postsCount: { type: Number, default: 0, min: 0 },
    recentPostsCount: { type: Number, default: 0, min: 0 },
    trendingScore: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: Date.now },
    isBanned: { type: Boolean, default: false },
    bannedAt: { type: Date },
    bannedById: { type: Schema.Types.ObjectId, ref: "User" },
  }
);
hashtagSchema.plugin(timestampsPlugin);
hashtagSchema.plugin(jsonTransformPlugin);
// No searchNormalizationPlugin here: `name` is already lowercase+trimmed
// at the field level, so a companion normalized field would be an exact
// duplicate. See companies/categories for where that plugin actually earns
// its keep (preserving display casing while still normalizing for search).
applySocialIndexes.hashtag(hashtagSchema);
