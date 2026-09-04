import { Schema } from "mongoose";

// {messageId, textSnippet} — a denormalized reply-preview, embedded on
// messages.replyTo so a chat UI can render "replying to: ..." without an
// extra lookup. Distinct from comments' parentCommentId/rootCommentId,
// which are plain ObjectId references (comment threads are unbounded and
// queried independently, so they don't carry a snapshot).
export const replyReferenceSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message" },
    textSnippet: { type: String, maxlength: 280 },
  },
  { _id: false }
);
