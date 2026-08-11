import { Schema } from "mongoose";
import { urlValidator } from "../../validators/index.js";

// A generic file reference with an integrity hash — distinct from Media
// (which is for displayable images/video/audio). Used for
// verificationDocuments, where the file is evidentiary (an ID scan, a
// business license), not content to render in a feed.
export const attachmentSchema = new Schema(
  {
    url: { type: String, required: true, validate: urlValidator },
    hash: { type: String }, // integrity check
    mimeType: { type: String },
    sizeBytes: { type: Number, min: 0 },
  },
  { _id: false }
);
