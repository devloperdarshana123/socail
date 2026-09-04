import { Schema } from "mongoose";
import { MEDIA_TYPE } from "../../constants/index.js";
import { urlValidator } from "../../validators/index.js";

// Reused by: socialPosts.media[], stories.media, messages.image,
// marketplaceListings.media[], profiles.avatar/coverPhoto,
// companies.logo/coverImage.
export const mediaSchema = new Schema(
  {
    url: { type: String, required: true, validate: urlValidator },
    publicId: { type: String }, // Cloudinary public_id, for deletion/transforms
    type: { type: String, enum: MEDIA_TYPE, default: "image" },
  },
  { _id: false }
);
