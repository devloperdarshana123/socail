export const applySocialIndexes = {
  socialPost(schema) {
    schema.index({ authorId: 1, createdAt: -1 }); // profile grid pagination
    schema.index({ caption: "text", hashtags: "text" }); // explore/search feed
  },

  comment(schema) {
    schema.index({ postId: 1, createdAt: 1 }); // thread, oldest-first
    schema.index({ parentCommentId: 1 });
    schema.index({ rootCommentId: 1 });
  },

  like(schema) {
    schema.index({ likedById: 1, targetType: 1, targetId: 1 }, { unique: true });
    schema.index({ targetType: 1, targetId: 1 }); // likers list, count
  },

  follow(schema) {
    schema.index({ followerId: 1, followingId: 1 }, { unique: true });
    schema.index({ followingId: 1 }); // followers-list in the other direction
  },

  saved(schema) {
    schema.index({ savedById: 1, postId: 1 }, { unique: true });
  },

  block(schema) {
    schema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
  },

  story(schema) {
    schema.index({ authorId: 1 });
    schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
  },

  storyView(schema) {
    schema.index({ storyId: 1, viewerId: 1 }, { unique: true });
  },

  postView(schema) {
    schema.index({ userId: 1, postId: 1 });
  },

  highlight(schema) {
    schema.index({ authorId: 1 });
  },

  hashtag(schema) {
    // `name` is already unique via the field definition.
    schema.index({ name: "text" });
    schema.index({ trendingScore: -1 });
  },
};
