import { Schema } from "mongoose";

// {status, at, byId} — an append-only status-change log entry, embedded on
// orders.timeline[]. Small, bounded, always read as one unit with the
// parent document — a textbook embed per the Phase 2 reasoning.
export const timelineEventSchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    byId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);
