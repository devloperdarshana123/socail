

// // import mongoose from "mongoose";

// // const { Schema, model, models } = mongoose;

// // // ─────────────────────────────────────────────
// // //  Constants
// // // ─────────────────────────────────────────────

// // export const SNAPSHOT_TYPES = ["image", "video", "text"];
// // export const RESOURCE_TYPES = ["image", "video"];
// // export const TEXT_ALIGN_OPTIONS = ["left", "center", "right"];

// // /** Max snapshots per highlight — enforced at app level AND via $slice on $push */
// // export const MAX_SNAPSHOTS = 100;

// // /**
// //  * Loose URL validator — accepts http / https only.
// //  * Fix #5, #6: blocks javascript: and data: URIs.
// //  */
// // const isHttpUrl = (v) => v === null || /^https?:\/\/.+/.test(v);

// // /**
// //  * CSS color / gradient validator — fix #7, #8.
// //  * Accepts:
// //  *   - null / empty (optional fields)
// //  *   - hex: #rgb, #rrggbb, #rrggbbaa
// //  *   - rgb() / rgba() / hsl() / hsla()
// //  *   - named CSS colors (basic check — starts with a letter, no < > chars)
// //  *   - linear-gradient / radial-gradient (common background values)
// //  * Blocks anything containing < > " ' ` (XSS via inline style injection)
// //  */
// // const isSafeCssValue = (v) => {
// //   if (!v) return true;
// //   if (/[<>"'`]/.test(v)) return false; // blocks HTML/script injection
// //   return (
// //     /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) || // hex
// //     /^rgba?\(/.test(v) ||                                                 // rgb/rgba
// //     /^hsla?\(/.test(v) ||                                                 // hsl/hsla
// //     /^(linear|radial|conic)-gradient\(/.test(v) ||                       // gradients
// //     /^[a-zA-Z][a-zA-Z\s]+$/.test(v)                                      // named colors
// //   );
// // };

// // // ─────────────────────────────────────────────
// // //  Sub-schema: Media Snapshot
// // //  Permanent copy — survives story expiry
// // // ─────────────────────────────────────────────

// // const snapshotSchema = new Schema(
// //   {
// //     // Soft reference — story may have expired/been deleted
// //     storyId: { type: Schema.Types.ObjectId, ref: "Story", default: null },

// //     type: {
// //       type: String,
// //       enum: { values: SNAPSHOT_TYPES, message: "type must be image, video, or text" },
// //       required: [true, "snapshot type is required"],
// //     },

// //     // ── Media fields (type: image | video) ────
// //     url: {
// //       type: String,
// //       default: null,
// //       trim: true,
// //       validate: { validator: isHttpUrl, message: "url must be a valid http/https URL" },
// //     },
// //     publicId: {
// //       type: String,
// //       default: null,
// //       trim: true,
// //     },
// //     resourceType: {
// //       type: String,
// //       enum: { values: [...RESOURCE_TYPES, null], message: "resourceType must be image or video" },
// //       default: null,
// //     },
// //     thumbnailUrl: {
// //       type: String,
// //       default: null,
// //       trim: true,
// //       validate: { validator: isHttpUrl, message: "thumbnailUrl must be a valid http/https URL" },
// //     },

// //     // ── Text story fields (type: text) ────────
// //     textContent: {
// //       text: { type: String, default: null, trim: true, maxlength: [500, "Text cannot exceed 500 chars"] },
// //       // Fix #7: CSS injection guard
// //       background: {
// //         type: String,
// //         default: null,
// //         trim: true,
// //         validate: { validator: isSafeCssValue, message: "background contains invalid characters" },
// //       },
// //       textAlign: {
// //         type: String,
// //         enum: { values: TEXT_ALIGN_OPTIONS, message: "textAlign must be left, center, or right" },
// //         default: "center",
// //       },
// //       // Fix #8: hex/CSS color validation
// //       textColor: {
// //         type: String,
// //         default: "#ffffff",
// //         trim: true,
// //         validate: { validator: isSafeCssValue, message: "textColor must be a valid CSS color" },
// //       },
// //     },

// //     // Fix #3: explicit function form — consistent with rest of codebase
// //     addedAt: { type: Date, default: () => new Date() },
// //   },
// //   { _id: true } // _id: true is critical — used for targeted $pull by snapshot _id (fix #4)
// // );

// // // ─────────────────────────────────────────────
// // //  Snapshot cross-field validation hook
// // //  Fix #14: type must match presence of url / textContent.text
// // // ─────────────────────────────────────────────

// // snapshotSchema.pre("validate", function (next) {
// //   if (this.type === "image" || this.type === "video") {
// //     if (!this.url) {
// //       return next(new Error(`snapshot.url is required when type is "${this.type}"`));
// //     }
// //   }
// //   if (this.type === "text") {
// //     if (!this.textContent?.text) {
// //       return next(new Error("snapshot.textContent.text is required when type is \"text\""));
// //     }
// //   }
// //   next();
// // });

// // // ─────────────────────────────────────────────
// // //  Main Schema
// // // ─────────────────────────────────────────────

// // const highlightSchema = new Schema(
// //   {
// //     author: {
// //       type: Schema.Types.ObjectId,
// //       ref: "User",
// //       required: [true, "author is required"],
// //     },

// //     title: {
// //       type: String,
// //       required: [true, "Highlight title is required"],
// //       trim: true,
// //       maxlength: [30, "Title cannot exceed 30 characters"],
// //     },

// //     // Fix #5: URL validation on cover fields
// //     coverImage: {
// //       type: String,
// //       default: null,
// //       trim: true,
// //       validate: { validator: isHttpUrl, message: "coverImage must be a valid http/https URL" },
// //     },
// //     coverPublicId: {
// //       type: String,
// //       default: null,
// //       trim: true,
// //     },

// //     /**
// //      * Permanent media snapshots — survive story expiry.
// //      *
// //      * Fix #2: The schema validator (v.length <= 100) runs on .save() only.
// //      * ALL programmatic $push operations MUST use the addSnapshot() static which
// //      * enforces the cap atomically with $slice. Never call $push directly from a controller.
// //      *
// //      * Fix #11: Validator is on the array level — fires on every .save() regardless
// //      * of which field changed. Accepted trade-off; $slice in addSnapshot is the real guard.
// //      */
// //     snapshots: {
// //       type: [snapshotSchema],
// //       default: [],
// //       validate: {
// //         validator: function (v) { return v.length <= MAX_SNAPSHOTS; },
// //         message: `Highlight cannot have more than ${MAX_SNAPSHOTS} stories`,
// //       },
// //     },

// //     isDeleted: { type: Boolean, default: false, index: true },

// //     // Fix #18: deletedAt for audit trail — consistent with other models
// //     deletedAt: { type: Date, default: null },
// //   },
// //   {
// //     timestamps: true,
// //     toJSON: { virtuals: true },
// //     toObject: { virtuals: true },
// //   }
// // );

// // // ─────────────────────────────────────────────
// // //  Virtuals
// // //  Fix #16: snapshotCount — avoids over-fetching full snapshots array just to count
// // // ─────────────────────────────────────────────

// // /**
// //  * snapshotCount — number of snapshots in this highlight.
// //  * Only accurate when snapshots array is populated (not projected away).
// //  * For count-only queries, use getMetadata() which projects { snapshots: 0 }... wait —
// //  * that gives 0. Use getByAuthorMeta() which uses $size aggregation instead.
// //  */
// // highlightSchema.virtual("snapshotCount").get(function () {
// //   return Array.isArray(this.snapshots) ? this.snapshots.length : 0;
// // });

// // // ─────────────────────────────────────────────
// // //  Indexes
// // // ─────────────────────────────────────────────

// // /**
// //  * Primary query: user's highlights feed, newest first, excluding deleted.
// //  */
// // highlightSchema.index(
// //   { author: 1, isDeleted: 1, createdAt: -1 },
// //   { name: "author_highlights_feed" }
// // );

// // /**
// //  * Fix #9 / #10: title lookup scoped to isDeleted to avoid returning soft-deleted highlights.
// //  * NOTE: unique: true intentionally omitted — Instagram allows duplicate highlight names.
// //  * If your product requires uniqueness, add unique: true here.
// //  */
// // highlightSchema.index(
// //   { author: 1, title: 1, isDeleted: 1 },
// //   { name: "author_title_lookup" }
// // );

// // /**
// //  * Fix #13: storyId lookup — "which highlights contain this story?"
// //  * Needed for story re-processing or cascade updates.
// //  * sparse: true — only indexes documents where snapshots.storyId exists.
// //  */
// // highlightSchema.index(
// //   { "snapshots.storyId": 1 },
// //   { sparse: true, name: "snapshot_story_ref" }
// // );

// // // ─────────────────────────────────────────────
// // //  Static Methods
// // // ─────────────────────────────────────────────

// // /**
// //  * getByAuthor — paginated highlights for a user's profile.
// //  * Returns full documents including snapshots.
// //  * For metadata-only (counts, titles, covers), use getByAuthorMeta().
// //  *
// //  * @param {ObjectId}      authorId
// //  * @param {ObjectId|null} [afterId]   — cursor: last Highlight._id
// //  * @param {number}        [limit=10]
// //  */
// // highlightSchema.statics.getByAuthor = async function (authorId, afterId = null, limit = 10) {
// //   const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
// //   const query = { author: authorId, isDeleted: false };
// //   if (afterId) query._id = { $lt: afterId };

// //   const docs = await this.find(query)
// //     .sort({ _id: -1 })
// //     .limit(safeLimit + 1)
// //     .lean();

// //   const hasMore = docs.length > safeLimit;
// //   if (hasMore) docs.pop();

// //   return {
// //     highlights: docs,
// //     nextCursor: hasMore ? docs[docs.length - 1]._id : null,
// //   };
// // };

// // /**
// //  * getByAuthorMeta — metadata only (no snapshot content).
// //  * Use for profile header grid: title, cover, count.
// //  * Fix #16: uses aggregation $size so you get snapshotCount without loading full arrays.
// //  *
// //  * @param {ObjectId} authorId
// //  */
// // highlightSchema.statics.getByAuthorMeta = function (authorId) {
// //   return this.aggregate([
// //     { $match: { author: new mongoose.Types.ObjectId(authorId), isDeleted: false } },
// //     { $sort: { createdAt: -1 } },
// //     {
// //       $project: {
// //         author: 1,
// //         title: 1,
// //         coverImage: 1,
// //         createdAt: 1,
// //         updatedAt: 1,
// //         snapshotCount: { $size: "$snapshots" }, // Fix #16: count without loading content
// //       },
// //     },
// //   ]);
// // };

// // /**
// //  * getById — fetch one highlight (author-scoped for authorization).
// //  *
// //  * @param {ObjectId} highlightId
// //  * @param {ObjectId} [authorId]  — if provided, checks ownership
// //  */
// // highlightSchema.statics.getById = async function (highlightId, authorId = null) {
// //   const query = { _id: highlightId, isDeleted: false };
// //   if (authorId) query.author = authorId;
// //   return this.findOne(query).lean();
// // };

// // /**
// //  * createHighlight — create with first snapshot.
// //  * Validates author != null, title length enforced by schema.
// //  *
// //  * @param {ObjectId}  authorId
// //  * @param {string}    title
// //  * @param {Object}    firstSnapshot   — matches snapshotSchema shape
// //  * @param {string}    [coverImage]
// //  * @param {string}    [coverPublicId]
// //  */
// // highlightSchema.statics.createHighlight = async function (
// //   authorId,
// //   title,
// //   firstSnapshot,
// //   coverImage = null,
// //   coverPublicId = null
// // ) {
// //   return this.create({
// //     author: authorId,
// //     title,
// //     coverImage,
// //     coverPublicId,
// //     snapshots: firstSnapshot ? [firstSnapshot] : [],
// //   });
// // };

// // /**
// //  * addSnapshot — atomically push a snapshot, capped at MAX_SNAPSHOTS.
// //  * Fix #2: uses $push + $slice to enforce cap at DB level, bypasses schema validator race.
// //  * Fix #4: snapshot gets a Mongoose-generated _id automatically (subdoc default).
// //  *
// //  * Returns null if cap already reached (check before calling, or handle null).
// //  *
// //  * @param {ObjectId} highlightId
// //  * @param {ObjectId} authorId        — ownership check
// //  * @param {Object}   snapshotData    — matches snapshotSchema shape
// //  */
// // highlightSchema.statics.addSnapshot = async function (highlightId, authorId, snapshotData) {
// //   // Pre-check cap to give a clean error (not a silent $slice truncation)
// //   const current = await this.findOne(
// //     { _id: highlightId, author: authorId, isDeleted: false },
// //     { "snapshots._id": 1 }
// //   ).lean();

// //   if (!current) return null;

// //   if (current.snapshots.length >= MAX_SNAPSHOTS) {
// //     throw new Error(`Highlight cannot exceed ${MAX_SNAPSHOTS} snapshots`);
// //   }

// //   const snapshot = {
// //     ...snapshotData,
// //     addedAt: new Date(),
// //     _id: new mongoose.Types.ObjectId(), // explicit _id for immediate reference
// //   };

// //   return this.findByIdAndUpdate(
// //     highlightId,
// //     {
// //       $push: {
// //         snapshots: {
// //           $each: [snapshot],
// //           $slice: -MAX_SNAPSHOTS, // safety net: keep last 100 even if pre-check races
// //         },
// //       },
// //     },
// //     { new: true, runValidators: false } // validator is redundant here; $slice is the guard
// //   ).lean();
// // };

// // /**
// //  * removeSnapshot — atomically remove one snapshot by its _id.
// //  * Fix #4: targeted $pull by subdocument _id — no array index logic.
// //  *
// //  * @param {ObjectId} highlightId
// //  * @param {ObjectId} authorId
// //  * @param {ObjectId} snapshotId   — the _id of the snapshot subdocument
// //  */
// // highlightSchema.statics.removeSnapshot = async function (highlightId, authorId, snapshotId) {
// //   return this.findOneAndUpdate(
// //     { _id: highlightId, author: authorId, isDeleted: false },
// //     { $pull: { snapshots: { _id: new mongoose.Types.ObjectId(snapshotId) } } },
// //     { new: true }
// //   ).lean();
// // };

// // /**
// //  * reorder — replace snapshots array with a caller-supplied ordered list of snapshot _ids.
// //  * Fix #17: centralized, race-safe reorder logic.
// //  *
// //  * Strategy: load current snapshots, sort by supplied id order, save.
// //  * We do NOT use findByIdAndUpdate here because $set on arrays doesn't reorder —
// //  * we need to load, sort in JS, and save. This is safe because highlight edits
// //  * are low-frequency user actions (not high-concurrency paths).
// //  *
// //  * @param {ObjectId}   highlightId
// //  * @param {ObjectId}   authorId
// //  * @param {ObjectId[]} orderedSnapshotIds  — full list of snapshot _ids in desired order
// //  */
// // highlightSchema.statics.reorder = async function (highlightId, authorId, orderedSnapshotIds) {
// //   const doc = await this.findOne({ _id: highlightId, author: authorId, isDeleted: false });
// //   if (!doc) return null;

// //   const idOrder = orderedSnapshotIds.map((id) => id.toString());
// //   const snapshotMap = new Map(doc.snapshots.map((s) => [s._id.toString(), s]));

// //   // Preserve snapshots not mentioned in the order list (append at end)
// //   const mentioned = new Set(idOrder);
// //   const unmentioned = doc.snapshots
// //     .filter((s) => !mentioned.has(s._id.toString()));

// //   doc.snapshots = [
// //     ...idOrder.map((id) => snapshotMap.get(id)).filter(Boolean),
// //     ...unmentioned,
// //   ];

// //   await doc.save();
// //   return doc.toObject();
// // };

// // /**
// //  * updateCover — update coverImage and coverPublicId.
// //  * Fix #15: documents that cover is independent of snapshots (custom cover allowed).
// //  *
// //  * @param {ObjectId} highlightId
// //  * @param {ObjectId} authorId
// //  * @param {string}   coverImage     — must be http/https URL
// //  * @param {string}   [coverPublicId]
// //  */
// // highlightSchema.statics.updateCover = function (
// //   highlightId,
// //   authorId,
// //   coverImage,
// //   coverPublicId = null
// // ) {
// //   return this.findOneAndUpdate(
// //     { _id: highlightId, author: authorId, isDeleted: false },
// //     { coverImage, coverPublicId },
// //     { new: true, runValidators: true }
// //   ).lean();
// // };

// // /**
// //  * updateTitle — rename a highlight.
// //  */
// // highlightSchema.statics.updateTitle = function (highlightId, authorId, title) {
// //   return this.findOneAndUpdate(
// //     { _id: highlightId, author: authorId, isDeleted: false },
// //     { title: title?.trim() },
// //     { new: true, runValidators: true }
// //   ).lean();
// // };

// // /**
// //  * softDelete — mark highlight as deleted with audit timestamp.
// //  * Fix #18: sets deletedAt for audit trail.
// //  *
// //  * @returns {{ deletedCount: 1 | 0 }}
// //  */
// // highlightSchema.statics.softDelete = async function (highlightId, authorId) {
// //   const result = await this.findOneAndUpdate(
// //     { _id: highlightId, author: authorId, isDeleted: false },
// //     { isDeleted: true, deletedAt: new Date() }
// //   );
// //   return { deletedCount: result ? 1 : 0 };
// // };

// // /**
// //  * softDeleteAllForUser — cascade delete when account is deleted.
// //  *
// //  * @returns {{ deletedCount: number }}
// //  */
// // highlightSchema.statics.softDeleteAllForUser = async function (authorId) {
// //   const result = await this.updateMany(
// //     { author: authorId, isDeleted: false },
// //     { isDeleted: true, deletedAt: new Date() }
// //   );
// //   return { deletedCount: result.modifiedCount ?? 0 };
// // };

// // /**
// //  * updateSnapshotsByStoryId — bulk-update snapshot data when a story is reprocessed.
// //  * Fix #13: uses the snapshots.storyId index.
// //  * Example use: story media URL changed after CDN migration.
// //  *
// //  * @param {ObjectId} storyId
// //  * @param {Object}   updateFields   — fields to $set on matching snapshots (e.g. { url, thumbnailUrl })
// //  */
// // highlightSchema.statics.updateSnapshotsByStoryId = function (storyId, updateFields) {
// //   const setFields = {};
// //   for (const [key, value] of Object.entries(updateFields)) {
// //     setFields[`snapshots.$[elem].${key}`] = value;
// //   }

// //   return this.updateMany(
// //     { "snapshots.storyId": new mongoose.Types.ObjectId(storyId) },
// //     { $set: setFields },
// //     {
// //       arrayFilters: [{ "elem.storyId": new mongoose.Types.ObjectId(storyId) }],
// //       runValidators: false, // URL validators don't run on arrayFilters path — validate in controller
// //     }
// //   );
// // };

// // /**
// //  * getHighlightsContainingStory — find all highlights that include a given story.
// //  * Fix #13: uses the snapshots.storyId index.
// //  *
// //  * @param {ObjectId} storyId
// //  */
// // highlightSchema.statics.getHighlightsContainingStory = function (storyId) {
// //   return this.find({
// //     "snapshots.storyId": new mongoose.Types.ObjectId(storyId),
// //     isDeleted: false,
// //   })
// //     .select("author title coverImage snapshots.$") // projected matching snapshot only
// //     .lean();
// // };

// // // ─────────────────────────────────────────────
// // //  Model Export
// // // ─────────────────────────────────────────────

// // const Highlight = models.Highlight || model("Highlight", highlightSchema);
// // export default Highlight;








// import mongoose from "mongoose";

// const { Schema, model, models } = mongoose;

// // ─────────────────────────────────────────────
// //  Constants
// // ─────────────────────────────────────────────

// export const SNAPSHOT_TYPES      = ["image", "video", "text"];
// export const RESOURCE_TYPES      = ["image", "video"];
// export const TEXT_ALIGN_OPTIONS  = ["left", "center", "right"];
// export const MAX_SNAPSHOTS       = 100;

// /**
//  * Loose URL validator — accepts http/https only.
//  * Blocks javascript: and data: URIs.
//  */
// const isHttpUrl = (v) => v === null || v === undefined || /^https?:\/\/.+/.test(v);

// /**
//  * CSS color / gradient validator.
//  * Blocks anything containing < > " ' ` (XSS via inline style injection).
//  */
// const isSafeCssValue = (v) => {
//   if (!v) return true;
//   if (/[<>"'`]/.test(v)) return false;
//   return (
//     /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ||
//     /^rgba?\(/.test(v)                                                ||
//     /^hsla?\(/.test(v)                                                ||
//     /^(linear|radial|conic)-gradient\(/.test(v)                       ||
//     /^[a-zA-Z][a-zA-Z\s]+$/.test(v)
//   );
// };

// // ─────────────────────────────────────────────
// //  Sub-schema: Snapshot
// //  PERMANENT FIX: pre("validate") hook removed entirely.
// //  Cross-field validation moved to custom schema-level validator
// //  on the `type` field — fires synchronously, no `next` involved.
// //  This is the production-grade Mongoose 7+ compatible approach.
// // ─────────────────────────────────────────────

// const snapshotSchema = new Schema(
//   {
//     storyId: { type: Schema.Types.ObjectId, ref: "Story", default: null },

//     type: {
//       type:     String,
//       enum:     { values: SNAPSHOT_TYPES, message: "type must be image, video, or text" },
//       required: [true, "snapshot type is required"],
//       // KEY FIX: cross-field validation on `type` field itself —
//       // runs synchronously during Mongoose validation pipeline,
//       // no pre-hook, no `next` parameter needed.
//       validate: [
//         {
//           // Rule 1: media snapshots must have url
//           validator: function (v) {
//             if (v === "image" || v === "video") {
//               return !!this.url;
//             }
//             return true;
//           },
//           message: (props) =>
//             `snapshot.url is required when type is "${props.value}"`,
//         },
//         {
//           // Rule 2: text snapshots must have textContent.text
//           validator: function (v) {
//             if (v === "text") {
//               return !!this.textContent?.text?.trim();
//             }
//             return true;
//           },
//           message: "snapshot.textContent.text is required when type is \"text\"",
//         },
//       ],
//     },

//     // ── Media fields (type: image | video) ──
//     url: {
//       type:     String,
//       default:  null,
//       trim:     true,
//       validate: { validator: isHttpUrl, message: "url must be a valid http/https URL" },
//     },
//     publicId: {
//       type:    String,
//       default: null,
//       trim:    true,
//     },
//     resourceType: {
//       type:    String,
//       enum:    { values: ["image", "video", null], message: "resourceType must be image or video" },
//       default: null,
//     },
//     thumbnailUrl: {
//       type:     String,
//       default:  null,
//       trim:     true,
//       validate: { validator: isHttpUrl, message: "thumbnailUrl must be a valid http/https URL" },
//     },

//     // ── Text story fields (type: text) ──
//     textContent: {
//       text: {
//         type:      String,
//         default:   null,
//         trim:      true,
//         maxlength: [500, "Text cannot exceed 500 chars"],
//       },
//       background: {
//         type:     String,
//         default:  null,
//         trim:     true,
//         validate: { validator: isSafeCssValue, message: "background contains invalid characters" },
//       },
//       textAlign: {
//         type:    String,
//         enum:    { values: TEXT_ALIGN_OPTIONS, message: "textAlign must be left, center, or right" },
//         default: "center",
//       },
//       textColor: {
//         type:     String,
//         default:  "#ffffff",
//         trim:     true,
//         validate: { validator: isSafeCssValue, message: "textColor must be a valid CSS color" },
//       },
//     },

//     addedAt: { type: Date, default: () => new Date() },
//   },
//   { _id: true }, // _id: true — used for targeted $pull by snapshot _id
// );

// // ─────────────────────────────────────────────
// //  Main Schema
// // ─────────────────────────────────────────────

// const highlightSchema = new Schema(
//   {
//     author: {
//       type:     Schema.Types.ObjectId,
//       ref:      "User",
//       required: [true, "author is required"],
//     },

//     title: {
//       type:      String,
//       required:  [true, "Highlight title is required"],
//       trim:      true,
//       maxlength: [30, "Title cannot exceed 30 characters"],
//     },

//     coverImage: {
//       type:     String,
//       default:  null,
//       trim:     true,
//       validate: { validator: isHttpUrl, message: "coverImage must be a valid http/https URL" },
//     },
//     coverPublicId: {
//       type:    String,
//       default: null,
//       trim:    true,
//     },

//     /**
//      * Permanent media snapshots — survive story expiry.
//      * ALL programmatic $push operations MUST use addSnapshot() static
//      * which enforces the cap atomically with $slice.
//      */
//     snapshots: {
//       type:     [snapshotSchema],
//       default:  [],
//       validate: {
//         validator: function (v) { return v.length <= MAX_SNAPSHOTS; },
//         message:   `Highlight cannot have more than ${MAX_SNAPSHOTS} stories`,
//       },
//     },

//     isDeleted: { type: Boolean, default: false, index: true },
//     deletedAt: { type: Date,    default: null },
//   },
//   {
//     timestamps: true,
//     toJSON:     { virtuals: true },
//     toObject:   { virtuals: true },
//   },
// );

// // ─────────────────────────────────────────────
// //  Virtuals
// // ─────────────────────────────────────────────

// highlightSchema.virtual("snapshotCount").get(function () {
//   return Array.isArray(this.snapshots) ? this.snapshots.length : 0;
// });

// // ─────────────────────────────────────────────
// //  Indexes
// // ─────────────────────────────────────────────

// highlightSchema.index(
//   { author: 1, isDeleted: 1, createdAt: -1 },
//   { name: "author_highlights_feed" },
// );

// highlightSchema.index(
//   { author: 1, title: 1, isDeleted: 1 },
//   { name: "author_title_lookup" },
// );

// highlightSchema.index(
//   { "snapshots.storyId": 1 },
//   { sparse: true, name: "snapshot_story_ref" },
// );

// // ─────────────────────────────────────────────
// //  Static Methods
// // ─────────────────────────────────────────────

// highlightSchema.statics.getByAuthor = async function (authorId, afterId = null, limit = 10) {
//   const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
//   const query     = { author: authorId, isDeleted: false };
//   if (afterId) query._id = { $lt: afterId };

//   const docs = await this.find(query)
//     .sort({ _id: -1 })
//     .limit(safeLimit + 1)
//     .lean();

//   const hasMore = docs.length > safeLimit;
//   if (hasMore) docs.pop();

//   return {
//     highlights: docs,
//     nextCursor: hasMore ? docs[docs.length - 1]._id : null,
//   };
// };

// highlightSchema.statics.getByAuthorMeta = function (authorId) {
//   return this.aggregate([
//     { $match: { author: new mongoose.Types.ObjectId(authorId), isDeleted: false } },
//     { $sort:  { createdAt: -1 } },
//     {
//       $project: {
//         author:        1,
//         title:         1,
//         coverImage:    1,
//         createdAt:     1,
//         updatedAt:     1,
//         snapshotCount: { $size: "$snapshots" },
//       },
//     },
//   ]);
// };

// highlightSchema.statics.getById = async function (highlightId, authorId = null) {
//   const query = { _id: highlightId, isDeleted: false };
//   if (authorId) query.author = authorId;
//   return this.findOne(query).lean();
// };

// highlightSchema.statics.createHighlight = async function (
//   authorId,
//   title,
//   firstSnapshot,
//   coverImage    = null,
//   coverPublicId = null,
// ) {
//   return this.create({
//     author: authorId,
//     title,
//     coverImage,
//     coverPublicId,
//     snapshots: firstSnapshot ? [firstSnapshot] : [],
//   });
// };

// /**
//  * addSnapshot — atomically push a snapshot, capped at MAX_SNAPSHOTS.
//  * Uses $push + $slice — bypasses .save() entirely, so no validation
//  * hook is triggered. This is intentional and safe because:
//  *   1. snapshotData is validated by the controller before calling this.
//  *   2. $slice enforces the cap at DB level.
//  *   3. runValidators: false avoids the subdocument hook issue permanently.
//  */
// highlightSchema.statics.addSnapshot = async function (highlightId, authorId, snapshotData) {
//   const current = await this.findOne(
//     { _id: highlightId, author: authorId, isDeleted: false },
//     { "snapshots._id": 1 },
//   ).lean();

//   if (!current) return null;

//   if (current.snapshots.length >= MAX_SNAPSHOTS) {
//     throw new Error(`Highlight cannot exceed ${MAX_SNAPSHOTS} snapshots`);
//   }

//   const snapshot = {
//     ...snapshotData,
//     addedAt: new Date(),
//     _id:     new mongoose.Types.ObjectId(),
//   };

//   return this.findByIdAndUpdate(
//     highlightId,
//     {
//       $push: {
//         snapshots: {
//           $each:  [snapshot],
//           $slice: -MAX_SNAPSHOTS,
//         },
//       },
//     },
//     { new: true, runValidators: false },
//   ).lean();
// };

// highlightSchema.statics.removeSnapshot = async function (highlightId, authorId, snapshotId) {
//   return this.findOneAndUpdate(
//     { _id: highlightId, author: authorId, isDeleted: false },
//     { $pull: { snapshots: { _id: new mongoose.Types.ObjectId(snapshotId) } } },
//     { new: true },
//   ).lean();
// };

// highlightSchema.statics.reorder = async function (highlightId, authorId, orderedSnapshotIds) {
//   const doc = await this.findOne({ _id: highlightId, author: authorId, isDeleted: false });
//   if (!doc) return null;

//   const idOrder      = orderedSnapshotIds.map((id) => id.toString());
//   const snapshotMap  = new Map(doc.snapshots.map((s) => [s._id.toString(), s]));
//   const mentioned    = new Set(idOrder);
//   const unmentioned  = doc.snapshots.filter((s) => !mentioned.has(s._id.toString()));

//   doc.snapshots = [
//     ...idOrder.map((id) => snapshotMap.get(id)).filter(Boolean),
//     ...unmentioned,
//   ];

//   await doc.save();
//   return doc.toObject();
// };

// highlightSchema.statics.updateCover = function (
//   highlightId,
//   authorId,
//   coverImage,
//   coverPublicId = null,
// ) {
//   return this.findOneAndUpdate(
//     { _id: highlightId, author: authorId, isDeleted: false },
//     { coverImage, coverPublicId },
//     { new: true, runValidators: true },
//   ).lean();
// };

// highlightSchema.statics.updateTitle = function (highlightId, authorId, title) {
//   return this.findOneAndUpdate(
//     { _id: highlightId, author: authorId, isDeleted: false },
//     { title: title?.trim() },
//     { new: true, runValidators: true },
//   ).lean();
// };

// highlightSchema.statics.softDelete = async function (highlightId, authorId) {
//   const result = await this.findOneAndUpdate(
//     { _id: highlightId, author: authorId, isDeleted: false },
//     { isDeleted: true, deletedAt: new Date() },
//   );
//   return { deletedCount: result ? 1 : 0 };
// };

// highlightSchema.statics.softDeleteAllForUser = async function (authorId) {
//   const result = await this.updateMany(
//     { author: authorId, isDeleted: false },
//     { isDeleted: true, deletedAt: new Date() },
//   );
//   return { deletedCount: result.modifiedCount ?? 0 };
// };

// highlightSchema.statics.updateSnapshotsByStoryId = function (storyId, updateFields) {
//   const setFields = {};
//   for (const [key, value] of Object.entries(updateFields)) {
//     setFields[`snapshots.$[elem].${key}`] = value;
//   }
//   return this.updateMany(
//     { "snapshots.storyId": new mongoose.Types.ObjectId(storyId) },
//     { $set: setFields },
//     {
//       arrayFilters:  [{ "elem.storyId": new mongoose.Types.ObjectId(storyId) }],
//       runValidators: false,
//     },
//   );
// };

// highlightSchema.statics.getHighlightsContainingStory = function (storyId) {
//   return this.find({
//     "snapshots.storyId": new mongoose.Types.ObjectId(storyId),
//     isDeleted:           false,
//   })
//     .select("author title coverImage snapshots.$")
//     .lean();
// };

// // ─────────────────────────────────────────────
// //  Model Export
// // ─────────────────────────────────────────────

// const Highlight = models.Highlight || model("Highlight", highlightSchema);
// export default Highlight;



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