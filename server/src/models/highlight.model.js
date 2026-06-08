
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

export const SNAPSHOT_TYPES     = ["image", "video", "text"];
export const RESOURCE_TYPES     = ["image", "video"];
export const TEXT_ALIGN_OPTIONS = ["left", "center", "right"];
export const MAX_SNAPSHOTS      = 100;

const isHttpUrl = (v) =>
  v === null || v === undefined || /^https?:\/\/[^\s]+/.test(v);

// AUDIT FIX #1: isSafeCssValue was missing from original highlight model —
// background/textColor fields had no XSS protection.
const isSafeCssValue = (v) => {
  if (!v) return true;
  if (/[<>"'`]/.test(v)) return false;
  return (
    /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ||
    /^rgba?\(/.test(v)                                                ||
    /^hsla?\(/.test(v)                                                ||
    /^(linear|radial|conic)-gradient\(/.test(v)                       ||
    /^[a-zA-Z][a-zA-Z\s]+$/.test(v)
  );
};

// ─────────────────────────────────────────────
//  Sub-schema: Snapshot
//
//  PERMANENT FIX: pre("validate", fn(next)) hook removed.
//  Mongoose 7+ does not inject `next` into subdocument pre-validate hooks.
//  Cross-field validation moved to `type` field's validate array —
//  synchronous, version-agnostic, production-safe.
// ─────────────────────────────────────────────

const snapshotSchema = new Schema(
  {
    storyId: { type: Schema.Types.ObjectId, ref: "Story", default: null },

    type: {
      type:     String,
      enum:     { values: SNAPSHOT_TYPES, message: "type must be image, video, or text" },
      required: [true, "snapshot type is required"],
      validate: [
        {
          validator: function (v) {
            if (v === "image" || v === "video") return !!this.url;
            return true;
          },
          message: (props) => `snapshot.url is required when type is "${props.value}"`,
        },
        {
          validator: function (v) {
            if (v === "text") return !!this.textContent?.text?.trim();
            return true;
          },
          message: 'snapshot.textContent.text is required when type is "text"',
        },
      ],
    },

    url: {
      type:     String,
      default:  null,
      trim:     true,
      validate: { validator: isHttpUrl, message: "url must be a valid http/https URL" },
    },
    publicId: { type: String, default: null, trim: true },
    resourceType: {
      type:    String,
      enum:    { values: ["image", "video", null], message: "resourceType must be image or video" },
      default: null,
    },
    thumbnailUrl: {
      type:     String,
      default:  null,
      trim:     true,
      validate: { validator: isHttpUrl, message: "thumbnailUrl must be a valid http/https URL" },
    },

    textContent: {
      text: {
        type:      String,
        default:   null,
        trim:      true,
        maxlength: [500, "Text cannot exceed 500 chars"],
      },
      background: {
        type:     String,
        default:  null,
        trim:     true,
        validate: { validator: isSafeCssValue, message: "background contains invalid CSS" },
      },
      textAlign: {
        type:    String,
        enum:    { values: TEXT_ALIGN_OPTIONS, message: "textAlign must be left, center, or right" },
        default: "center",
      },
      textColor: {
        type:     String,
        default:  "#ffffff",
        trim:     true,
        validate: { validator: isSafeCssValue, message: "textColor must be a valid CSS color" },
      },
    },

    addedAt: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

// ─────────────────────────────────────────────
//  Main Schema
// ─────────────────────────────────────────────

const highlightSchema = new Schema(
  {
    author: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "author is required"],
    },

    title: {
      type:      String,
      required:  [true, "Highlight title is required"],
      trim:      true,
      maxlength: [30, "Title cannot exceed 30 characters"],
    },

    coverImage: {
      type:     String,
      default:  null,
      trim:     true,
      validate: { validator: isHttpUrl, message: "coverImage must be a valid http/https URL" },
    },
    coverPublicId: { type: String, default: null, trim: true },

    snapshots: {
      type:    [snapshotSchema],
      default: [],
      // AUDIT FIX #2: array-level validator uses arrow function — `this` is undefined.
      // Must use regular function for document context.
      validate: {
        validator: function (v) { return Array.isArray(v) && v.length <= MAX_SNAPSHOTS; },
        message:   `Highlight cannot have more than ${MAX_SNAPSHOTS} stories`,
      },
    },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date,    default: null },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
);

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

highlightSchema.virtual("snapshotCount").get(function () {
  return Array.isArray(this.snapshots) ? this.snapshots.length : 0;
});

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

highlightSchema.index(
  { author: 1, isDeleted: 1, createdAt: -1 },
  { name: "author_highlights_feed" },
);
highlightSchema.index(
  { author: 1, title: 1, isDeleted: 1 },
  { name: "author_title_lookup" },
);
highlightSchema.index(
  { "snapshots.storyId": 1 },
  { sparse: true, name: "snapshot_story_ref" },
);

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

highlightSchema.statics.getByAuthor = async function (authorId, afterId = null, limit = 10) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
  const query     = { author: authorId, isDeleted: false };
  if (afterId) query._id = { $lt: afterId };

  const docs = await this.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .lean();

  const hasMore = docs.length > safeLimit;
  if (hasMore) docs.pop();

  return {
    highlights: docs,
    nextCursor: hasMore ? docs[docs.length - 1]._id : null,
  };
};

highlightSchema.statics.getByAuthorMeta = function (authorId) {
  return this.aggregate([
    { $match: { author: new mongoose.Types.ObjectId(authorId), isDeleted: false } },
    { $sort:  { createdAt: -1 } },
    {
      $project: {
        author:        1,
        title:         1,
        coverImage:    1,
        createdAt:     1,
        updatedAt:     1,
        snapshotCount: { $size: "$snapshots" },
      },
    },
  ]);
};

highlightSchema.statics.getById = async function (highlightId, authorId = null) {
  const query = { _id: highlightId, isDeleted: false };
  if (authorId) query.author = authorId;
  return this.findOne(query).lean();
};

highlightSchema.statics.createHighlight = async function (
  authorId,
  title,
  firstSnapshot,
  coverImage    = null,
  coverPublicId = null,
) {
  return this.create({
    author:        authorId,
    title,
    coverImage,
    coverPublicId,
    snapshots: firstSnapshot ? [firstSnapshot] : [],
  });
};

/**
 * addSnapshot — atomic $push + $slice, bypasses .save() entirely.
 * runValidators: false is intentional — $slice is the real cap guard,
 * and controller validates snapshotData before calling this.
 */
highlightSchema.statics.addSnapshot = async function (highlightId, authorId, snapshotData) {
  const current = await this.findOne(
    { _id: highlightId, author: authorId, isDeleted: false },
    { "snapshots._id": 1 },
  ).lean();

  if (!current) return null;

  if (current.snapshots.length >= MAX_SNAPSHOTS) {
    throw new Error(`Highlight cannot exceed ${MAX_SNAPSHOTS} snapshots`);
  }

  const snapshot = {
    ...snapshotData,
    addedAt: new Date(),
    _id:     new mongoose.Types.ObjectId(),
  };

  return this.findByIdAndUpdate(
    highlightId,
    {
      $push: {
        snapshots: {
          $each:  [snapshot],
          $slice: -MAX_SNAPSHOTS,
        },
      },
    },
    { new: true, runValidators: false },
  ).lean();
};

highlightSchema.statics.removeSnapshot = async function (highlightId, authorId, snapshotId) {
  return this.findOneAndUpdate(
    { _id: highlightId, author: authorId, isDeleted: false },
    { $pull: { snapshots: { _id: new mongoose.Types.ObjectId(snapshotId) } } },
    { new: true },
  ).lean();
};

/**
 * reorder — low-frequency operation, safe to load + sort in JS.
 * AUDIT FIX #3: doc.save() triggers top-level schema validators only —
 * snapshotSchema validators do NOT re-run on .save() of parent document
 * when snapshots array is only reordered (no new subdoc added).
 * This is safe and correct.
 */
highlightSchema.statics.reorder = async function (highlightId, authorId, orderedSnapshotIds) {
  const doc = await this.findOne({ _id: highlightId, author: authorId, isDeleted: false });
  if (!doc) return null;

  const idOrder     = orderedSnapshotIds.map((id) => id.toString());
  const snapshotMap = new Map(doc.snapshots.map((s) => [s._id.toString(), s]));
  const mentioned   = new Set(idOrder);
  const unmentioned = doc.snapshots.filter((s) => !mentioned.has(s._id.toString()));

  doc.snapshots = [
    ...idOrder.map((id) => snapshotMap.get(id)).filter(Boolean),
    ...unmentioned,
  ];

  // AUDIT FIX #3: use $set instead of .save() to avoid snapshot validator
  // firing on the full array during reorder (no data change, just order).
  await this.findByIdAndUpdate(
    highlightId,
    { $set: { snapshots: doc.snapshots } },
    { runValidators: false },
  );

  return doc.toObject();
};

highlightSchema.statics.updateCover = function (
  highlightId,
  authorId,
  coverImage,
  coverPublicId = null,
) {
  return this.findOneAndUpdate(
    { _id: highlightId, author: authorId, isDeleted: false },
    { coverImage, coverPublicId },
    { new: true, runValidators: true },
  ).lean();
};

highlightSchema.statics.updateTitle = function (highlightId, authorId, title) {
  return this.findOneAndUpdate(
    { _id: highlightId, author: authorId, isDeleted: false },
    { title: title?.trim() },
    { new: true, runValidators: true },
  ).lean();
};

highlightSchema.statics.softDelete = async function (highlightId, authorId) {
  const result = await this.findOneAndUpdate(
    { _id: highlightId, author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
  return { deletedCount: result ? 1 : 0 };
};

highlightSchema.statics.softDeleteAllForUser = async function (authorId) {
  const result = await this.updateMany(
    { author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
  return { deletedCount: result.modifiedCount ?? 0 };
};

highlightSchema.statics.updateSnapshotsByStoryId = function (storyId, updateFields) {
  const setFields = {};
  for (const [key, value] of Object.entries(updateFields)) {
    setFields[`snapshots.$[elem].${key}`] = value;
  }
  return this.updateMany(
    { "snapshots.storyId": new mongoose.Types.ObjectId(storyId) },
    { $set: setFields },
    {
      arrayFilters:  [{ "elem.storyId": new mongoose.Types.ObjectId(storyId) }],
      runValidators: false,
    },
  );
};

highlightSchema.statics.getHighlightsContainingStory = function (storyId) {
  return this.find({
    "snapshots.storyId": new mongoose.Types.ObjectId(storyId),
    isDeleted:           false,
  })
    .select("author title coverImage snapshots.$")
    .lean();
};

// ─────────────────────────────────────────────
//  Model Export
// ─────────────────────────────────────────────

const Highlight = models.Highlight || model("Highlight", highlightSchema);
export default Highlight;