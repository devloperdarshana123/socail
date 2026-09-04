import { Schema } from "mongoose";
import { geoPointValidator } from "../../validators/index.js";

// GeoJSON Point — the canonical geospatial type, reused wherever a
// 2dsphere-indexable coordinate pair is needed: locations.coordinates
// (canonical) and LocationSummary.coordinates (denormalized snapshot).
export const geoLocationSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: geoPointValidator,
    },
  },
  { _id: false }
);
