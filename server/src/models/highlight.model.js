import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

// ── Media Snapshot — story expire hone ke baad bhi rahega ──
const snapshotSchema = new Schema(
  {
    storyId:      { type: Schema.Types.ObjectId, default: null }, // reference (may expire)
    type:         { type: String, enum: ["image", "video", "text"], required: true },

    // Media stories ke liye
    url:          { type: String, default: null },
    publicId:     { type: String, default: null }, // Cloudinary publicId — permanent copy
    resourceType: { type: String, enum: ["image", "video"], default: null },
    thumbnailUrl: { type: String, default: null },

    // Text stories ke liye
    textContent: {
      text:       { type: String, default: null },
      background: { type: String, default: null },
      textAlign:  { type: String, enum: ["left", "center", "right"], default: "center" },
      textColor:  { type: String, default: "#ffffff" },
    },

    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const highlightSchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Highlight title is required"],
      trim: true,
      maxlength: [30, "Title cannot exceed 30 characters"],
    },
    coverImage:    { type: String, default: null },  // Cloudinary URL — permanent
    coverPublicId: { type: String, default: null },  // for future cover change/delete

    // Permanent snapshots — story expire hone ke baad bhi content yahaan rahega
    snapshots: {
      type: [snapshotSchema],
      default: [],
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

highlightSchema.index({ author: 1, isDeleted: 1, createdAt: -1 });

const Highlight = models.Highlight || model("Highlight", highlightSchema);
export default Highlight;