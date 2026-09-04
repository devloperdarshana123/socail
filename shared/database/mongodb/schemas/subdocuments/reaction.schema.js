import { Schema } from "mongoose";

// {userId, emoji} — embedded reaction, reused by messages.reactions[].
// (The `likes` collection models one-reaction-per-user as its own document
// instead, since it needs a compound unique index across a huge, unbounded
// user base — this shape is specifically for small, bounded arrays.)
export const reactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, default: "❤️" },
  },
  { _id: false }
);
