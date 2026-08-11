import { Schema } from "mongoose";

// marketplaceListings.specifications — a few well-known fields common
// across stone/marble listings, plus an open `extra` bag for
// category-specific attributes that vary too much to enumerate up front
// (matches the "…" in the Phase 2 design's field list literally).
export const specificationSchema = new Schema(
  {
    material: { type: String },
    grade: { type: String },
    finish: { type: String },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      thickness: { type: Number, min: 0 },
      unit: { type: String, default: "cm" },
    },
    extra: { type: Schema.Types.Mixed },
  },
  { _id: false }
);
