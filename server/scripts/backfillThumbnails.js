import "dotenv/config";
import mongoose from "mongoose";
import cloudinary from "../src/config/cloudinaryConfig.js";
import Post from "../src/models/post.model.js";

await mongoose.connect(process.env.MONGO_URI);

const reels = await Post.find({
  type:      "reel",
  isDeleted: false,
  $or: [
    { "media.0.thumbnailUrl": null },
    { "media.0.thumbnailUrl": { $exists: false } },
  ],
});

console.log(`${reels.length} reels found without thumbnail`);

for (const post of reels) {
  const m = post.media[0];
  if (!m?.publicId) continue;

  try {
    const result = await cloudinary.uploader.explicit(m.publicId, {
      type:          "upload",
      resource_type: "video",
      eager: [
        {
          format: "jpg",
          transformation: [
            { start_offset: "0" },
            { width: 600, crop: "scale" },
            { quality: "auto:good" },
          ],
        },
      ],
      eager_async: false,
    });

    const thumbUrl = result.eager?.[0]?.secure_url;
    if (thumbUrl) {
      post.media[0].thumbnailUrl = thumbUrl;
      await post.save();
      console.log(`✓ ${post._id}`);
    } else {
      console.log(`- No thumbnail: ${post._id}`);
    }
  } catch (err) {
    console.error(`✗ ${post._id} — ${err.message}`);
  }
}

console.log("Done.");
await mongoose.disconnect();