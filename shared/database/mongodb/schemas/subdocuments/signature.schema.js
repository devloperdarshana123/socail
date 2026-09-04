import { Schema } from "mongoose";

// {partyId, signedAt, ipAddress} — embedded on contracts.signatures[].
// Small, bounded, append-only, scoped entirely to its parent contract.
export const signatureSchema = new Schema(
  {
    partyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    signedAt: { type: Date },
    ipAddress: { type: String },
  },
  { _id: false }
);
