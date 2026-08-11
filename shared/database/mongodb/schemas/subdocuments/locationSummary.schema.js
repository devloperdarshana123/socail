import { Schema } from "mongoose";
import { geoLocationSchema } from "./geoLocation.schema.js";

// Lightweight denormalized snapshot of a `locations` document, embedded on
// `companies` and `marketplaceListings` so list/map views never need a
// join for the common case. The canonical, 2dsphere-indexed record always
// lives in `locations`; this is read-only display data kept in sync by the
// write path (see the Phase 2 design, Group 2/6).
export const locationSummarySchema = new Schema(
  {
    city: { type: String },
    country: { type: String },
    coordinates: { type: geoLocationSchema },
  },
  { _id: false }
);
