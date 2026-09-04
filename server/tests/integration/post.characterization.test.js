// Characterization test for the `post` domain (Milestone 5D — medium reference).
// Two concerns are locked down against a real Postgres BEFORE refactoring:
//   1. postHelpers.js behavior behind every DB-touching post endpoint.
//   2. The 10 direct Prisma queries currently inline in post.controller.js,
//      characterized via exact inline mirrors. After extraction, the same
//      assertions are re-expressed against the new helper methods.
// (deleteUnusedMedia / bulkDeleteUnusedMedia touch no DB — nothing to lock.)
import { PrismaClient } from "@prisma/client";
import * as PostHelper from "../../src/utils/postHelpers.js";
import {
  socialPostRepository,
  userRepository,
  followRepository,
  likeRepository,
  postViewRepository,
} from "../../src/config/repositories.js";
import { transactionRunner } from "../../src/config/transaction.js";

const prisma = new PrismaClient();

const userIds = [];
const postIds = [];

async function makeUser({ isPrivate = false, accountStatus = "active", role = "user" } = {}) {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: { fullName: `Post Test ${s}`, email: `post-${s}@e.com`, username: `post_${s}`, isPrivate, accountStatus, role },
  });
  userIds.push(u.id);
  return u;
}
async function makePost(authorId, extra = {}) {
  const p = await prisma.post.create({ data: { type: "image", authorId, visibility: "public", ...extra } });
  postIds.push(p.id);
  return p;
}
async function postsCountOf(userId) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { postsCount: true } })).postsCount;
}

afterAll(async () => {
  await prisma.postView.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.post.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: userIds } }, { followingId: { in: userIds } }] } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("postHelpers — persistence behind each endpoint (characterization)", () => {
  test("createPost (text) creates a post and increments author's postsCount", async () => {
    const u = await makeUser();
    const before = await postsCountOf(u.id);
    const post = await PostHelper.createPost(u.id, { type: "text", caption: "hello", media: [], isDraft: false });
    postIds.push(post.id);
    expect(post.id).toBeTruthy();
    expect(post.author.id).toBe(u.id);
    expect(await postsCountOf(u.id)).toBe(before + 1);
  });

  test("createPost as draft does NOT increment postsCount", async () => {
    const u = await makeUser();
    const before = await postsCountOf(u.id);
    const post = await PostHelper.createPost(u.id, { type: "text", caption: "draft", media: [], isDraft: true });
    postIds.push(post.id);
    expect(post.isDraft).toBe(true);
    expect(await postsCountOf(u.id)).toBe(before);
  });

  test("getPostById returns a visible post, null for deleted, null for others' drafts", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { caption: "visible" });
    expect((await PostHelper.getPostById(post.id, u.id)).id).toBe(post.id);

    const deleted = await makePost(u.id, { isDeleted: true, deletedAt: new Date() });
    expect(await PostHelper.getPostById(deleted.id, u.id)).toBeNull();

    const draft = await makePost(u.id, { isDraft: true });
    expect(await PostHelper.getPostById(draft.id, "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect((await PostHelper.getPostById(draft.id, u.id)).id).toBe(draft.id); // owner can see own draft
  });

  test("getFeedPosts returns public, non-deleted, non-draft posts for the author set", async () => {
    const u = await makeUser();
    const pub = await makePost(u.id);
    await makePost(u.id, { isDraft: true });
    await makePost(u.id, { isDeleted: true, deletedAt: new Date() });
    const { items } = await PostHelper.getFeedPosts([u.id], { limit: 50 });
    const ids = items.map((p) => p.id);
    expect(ids).toContain(pub.id);
    expect(ids.length).toBe(1);
  });

  test("getUserPosts hides a private account's posts from non-followers, shows to owner", async () => {
    const priv = await makeUser({ isPrivate: true });
    await makePost(priv.id);
    const asStranger = await PostHelper.getUserPosts(priv.id, false, false, { limit: 18 });
    expect(asStranger.items).toEqual([]);
    const asOwner = await PostHelper.getUserPosts(priv.id, false, true, { limit: 18 });
    expect(asOwner.items.length).toBe(1);
  });

  test("deletePost soft-deletes for the owner (decrementing count), null for non-owner", async () => {
    const u = await makeUser();
    const post = await PostHelper.createPost(u.id, { type: "text", caption: "x", media: [], isDraft: false });
    postIds.push(post.id);
    const before = await postsCountOf(u.id);

    expect(await PostHelper.deletePost(post.id, "00000000-0000-0000-0000-000000000000")).toBeNull();

    const deleted = await PostHelper.deletePost(post.id, u.id);
    expect(deleted.id).toBe(post.id);
    expect((await prisma.post.findUnique({ where: { id: post.id } })).isDeleted).toBe(true);
    expect(await postsCountOf(u.id)).toBe(before - 1);
  });

  test("getDraftPosts returns only the user's drafts", async () => {
    const u = await makeUser();
    const draft = await makePost(u.id, { isDraft: true });
    await makePost(u.id); // published, should not appear
    const { items } = await PostHelper.getDraftPosts(u.id, { limit: 20 });
    const ids = items.map((p) => p.id);
    expect(ids).toContain(draft.id);
    expect(ids.every((id) => id === draft.id)).toBe(true);
  });

  test("publishDraft flips a draft to published and increments count; null for non-owner", async () => {
    const u = await makeUser();
    const draft = await makePost(u.id, { isDraft: true, media: [{ url: "u", publicId: "p" }] });
    const before = await postsCountOf(u.id);
    expect(await PostHelper.publishDraft(draft.id, "00000000-0000-0000-0000-000000000000")).toBeNull();
    const published = await PostHelper.publishDraft(draft.id, u.id);
    expect(published.isDraft).toBe(false);
    expect(await postsCountOf(u.id)).toBe(before + 1);
  });

  test("updatePost updates the caption for the owner, null for non-owner", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { caption: "old" });
    expect(await PostHelper.updatePost(post.id, "00000000-0000-0000-0000-000000000000", { caption: "new" })).toBeNull();
    const updated = await PostHelper.updatePost(post.id, u.id, { caption: "new caption" });
    expect(updated.caption).toBe("new caption");
  });

  test("recordPostView records a new view (increment) but not a self-view", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    const post = await makePost(author.id);

    const self = await PostHelper.recordPostView(post.id, author.id, {});
    expect(self.selfView).toBe(true);
    expect(self.isNewView).toBe(false);

    const view = await PostHelper.recordPostView(post.id, viewer.id, { source: "feed", duration: 3, device: "desktop" });
    expect(view.isNewView).toBe(true);
    expect(view.viewsCount).toBe(1);
  });
});

// Exact inline mirrors of the 10 direct queries currently in the controller.
describe("post controller direct queries — baseline (inline mirror)", () => {
  test("getPostInteraction trio: like / saved / counts", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    const post = await makePost(author.id);
    await prisma.like.create({ data: { likedById: viewer.id, postId: post.id, targetModel: "Post", reaction: "❤️" } });
    await prisma.saved.create({ data: { savedById: viewer.id, postId: post.id } });

    const [liked, saved, counts] = await Promise.all([
      prisma.like.findFirst({ where: { likedById: viewer.id, postId: post.id, commentId: null, storyId: null }, select: { id: true } }),
      prisma.saved.findUnique({ where: { savedById_postId: { savedById: viewer.id, postId: post.id } }, select: { id: true } }),
      prisma.post.findUnique({ where: { id: post.id }, select: { likesCount: true, commentsCount: true, viewsCount: true } }),
    ]);
    expect(!!liked).toBe(true);
    expect(!!saved).toBe(true);
    expect(Object.keys(counts).sort()).toEqual(["commentsCount", "likesCount", "viewsCount"].sort());
  });

  test("getFeedPosts pre-queries: accepted following ids + super_admin ids", async () => {
    const u = await makeUser();
    const followed = await makeUser();
    const admin = await makeUser({ role: "super_admin" });
    await prisma.follow.create({ data: { followerId: u.id, followingId: followed.id, status: "accepted" } });

    const follows = await prisma.follow.findMany({ where: { followerId: u.id, status: "accepted" }, select: { followingId: true } });
    expect(follows.map((f) => f.followingId)).toContain(followed.id);

    const admins = await prisma.user.findMany({ where: { role: "super_admin" }, select: { id: true } });
    expect(admins.map((a) => a.id)).toContain(admin.id);
  });

  test("getUserPosts pre-queries: role/privacy, count, follow status", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    await makePost(author.id);
    await makePost(author.id, { isDraft: true }); // excluded from count
    await prisma.follow.create({ data: { followerId: viewer.id, followingId: author.id, status: "accepted" } });

    const rp = await prisma.user.findUnique({ where: { id: author.id }, select: { role: true, isPrivate: true } });
    expect(Object.keys(rp).sort()).toEqual(["isPrivate", "role"].sort());

    const count = await prisma.post.count({ where: { authorId: author.id, isDeleted: false, isDraft: false } });
    expect(count).toBe(1);

    const follow = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: author.id } }, select: { status: true } });
    expect(follow.status).toBe("accepted");
  });

  test("updatePost pre-query: current media; recordView post-query: viewsCount", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { media: [{ url: "u", publicId: "p1" }] });
    const media = await prisma.post.findUnique({ where: { id: post.id }, select: { media: true } });
    expect(Array.isArray(media.media)).toBe(true);
    const views = await prisma.post.findUnique({ where: { id: post.id }, select: { viewsCount: true } });
    expect(Object.keys(views)).toEqual(["viewsCount"]);
  });
});

// After extraction: the 10 helper methods must match the inline behavior.
describe("postHelpers — extracted controller queries match inline behavior", () => {
  test("findPostLikeByUser / findPostSavedByUser / getPostInteractionCounts", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    const post = await makePost(author.id);
    expect(await PostHelper.findPostLikeByUser(viewer.id, post.id)).toBeNull();
    expect(await PostHelper.findPostSavedByUser(viewer.id, post.id)).toBeNull();
    await prisma.like.create({ data: { likedById: viewer.id, postId: post.id, targetModel: "Post", reaction: "❤️" } });
    await prisma.saved.create({ data: { savedById: viewer.id, postId: post.id } });
    expect((await PostHelper.findPostLikeByUser(viewer.id, post.id)).id).toBeTruthy();
    expect((await PostHelper.findPostSavedByUser(viewer.id, post.id)).id).toBeTruthy();
    const counts = await PostHelper.getPostInteractionCounts(post.id);
    expect(Object.keys(counts).sort()).toEqual(["commentsCount", "likesCount", "viewsCount"].sort());
  });

  test("getAcceptedFollowingIds / getSuperAdminIds", async () => {
    const u = await makeUser();
    const followed = await makeUser();
    const admin = await makeUser({ role: "super_admin" });
    await prisma.follow.create({ data: { followerId: u.id, followingId: followed.id, status: "accepted" } });
    expect((await PostHelper.getAcceptedFollowingIds(u.id)).map((f) => f.followingId)).toContain(followed.id);
    expect((await PostHelper.getSuperAdminIds()).map((a) => a.id)).toContain(admin.id);
  });

  test("getUserRoleAndPrivacy / countVisibleUserPosts / getFollowStatus", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    await makePost(author.id);
    await makePost(author.id, { isDraft: true });
    await prisma.follow.create({ data: { followerId: viewer.id, followingId: author.id, status: "accepted" } });
    const rp = await PostHelper.getUserRoleAndPrivacy(author.id);
    expect(Object.keys(rp).sort()).toEqual(["isPrivate", "role"].sort());
    expect(await PostHelper.countVisibleUserPosts(author.id)).toBe(1);
    expect((await PostHelper.getFollowStatus(viewer.id, author.id)).status).toBe("accepted");
    expect(await PostHelper.getFollowStatus(author.id, viewer.id)).toBeNull();
  });

  test("getPostMediaForUpdate / getPostViewsCount, null for missing", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { media: [{ url: "u", publicId: "p1" }] });
    expect(Object.keys(await PostHelper.getPostMediaForUpdate(post.id))).toEqual(["media"]);
    expect(Object.keys(await PostHelper.getPostViewsCount(post.id))).toEqual(["viewsCount"]);
    expect(await PostHelper.getPostMediaForUpdate("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await PostHelper.getPostViewsCount("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5D suite above never had.
// Written and run GREEN against the original direct-Prisma implementation
// BEFORE the repository migration, so they are a true before/after net.
//
// NETWORK ISOLATION: createPost/updatePost call finalizeMedia(), which only
// contacts Cloudinary for publicIds starting with "temp_uploads/". Every
// fixture below uses non-temp publicIds, so finalizeMedia is a pure
// pass-through. Reel fixtures always supply a thumbnailUrl so the
// cloudinary.uploader.explicit() thumbnail branch is never entered.
// ─────────────────────────────────────────────────────────────────────────

const MISSING = "00000000-0000-0000-0000-000000000000";
const AUTHOR_KEYS = ["avatar", "fullName", "id", "isVerifiedBadge", "username"];

// A media item that finalizeMedia will pass through untouched.
const localMedia = (publicId = "erovians/posts/p1", extra = {}) => ({
  url: `https://cdn/${publicId}.jpg`,
  publicId,
  resourceType: "image",
  ...extra,
});

describe("postHelpers — createPost details (Phase 7A)", () => {
  test("sanitizeMediaItem normalizes types, coerces numbers, and stamps order", () => {
    const out = PostHelper.sanitizeMediaItem(
      {
        url: 123,
        publicId: 456,
        resourceType: "gif", // not image|video
        width: "1080",
        height: "1920",
        duration: "0",
        thumbnailUrl: "",
        format: "jpg",
        bytes: "5000",
      },
      3
    );

    expect(out.url).toBe("123"); // Stringified
    expect(out.publicId).toBe("456");
    expect(out.resourceType).toBe("image"); // invalid → image
    expect(out.width).toBe(1080);
    expect(out.height).toBe(1920);
    expect(out.duration).toBeNull(); // Number("0") is 0 → falsy → null
    expect(out.thumbnailUrl).toBeNull(); // "" is falsy → null
    expect(out.format).toBe("jpg");
    expect(out.bytes).toBe(5000);
    expect(out.order).toBe(3);
  });

  test("sanitizeMediaItem defaults every optional field for an empty item", () => {
    const out = PostHelper.sanitizeMediaItem({}, 0);
    expect(out).toEqual({
      url: "",
      publicId: "",
      resourceType: "image",
      width: null,
      height: null,
      duration: null,
      thumbnailUrl: null,
      format: null,
      bytes: null,
      order: 0,
    });
  });

  test("createPost persists sanitized media in order and applies flag defaults", async () => {
    const u = await makeUser();
    const post = await PostHelper.createPost(u.id, {
      type: "image",
      caption: "  spaced  ",
      media: [localMedia("erovians/posts/a"), localMedia("erovians/posts/b")],
    });
    postIds.push(post.id);

    expect(post.caption).toBe("spaced"); // trimmed
    expect(post.media.map((m) => m.order)).toEqual([0, 1]);
    expect(post.media[0].publicId).toBe("erovians/posts/a");
    expect(post.visibility).toBe("public"); // default
    expect(post.commentsDisabled).toBe(false);
    expect(post.likesHidden).toBe(false);
    expect(post.isDraft).toBe(false);
    expect(post.location).toBeNull();
  });

  test("createPost truncates a caption to 2200 characters", async () => {
    const u = await makeUser();
    const post = await PostHelper.createPost(u.id, {
      type: "text",
      caption: "x".repeat(2500),
      media: [],
    });
    postIds.push(post.id);
    expect(post.caption.length).toBe(2200);
  });

  test("createPost honours explicit visibility and boolean flags", async () => {
    const u = await makeUser();
    const post = await PostHelper.createPost(u.id, {
      type: "text",
      media: [],
      visibility: "followers",
      commentsDisabled: "yes", // truthy → Boolean() → true
      likesHidden: 1,
    });
    postIds.push(post.id);
    expect(post.visibility).toBe("followers");
    expect(post.commentsDisabled).toBe(true);
    expect(post.likesHidden).toBe(true);
  });

  test("createPost parses a location object into a GeoJSON Point", async () => {
    const u = await makeUser();
    const post = await PostHelper.createPost(u.id, {
      type: "text",
      media: [],
      location: { name: "  Carrara  ", lat: "44.0793", lng: "10.0977" },
    });
    postIds.push(post.id);

    expect(post.location).toEqual({
      name: "Carrara", // trimmed
      coordinates: { type: "Point", coordinates: [10.0977, 44.0793] }, // lng, lat
    });
  });

  test("createPost accepts a JSON-string location and drops coordinates when incomplete", async () => {
    const u = await makeUser();
    const asString = await PostHelper.createPost(u.id, {
      type: "text",
      media: [],
      location: JSON.stringify({ name: "Verona", lat: "45.4", lng: "10.9" }),
    });
    postIds.push(asString.id);
    expect(asString.location.name).toBe("Verona");
    expect(asString.location.coordinates.coordinates).toEqual([10.9, 45.4]);

    const noCoords = await PostHelper.createPost(u.id, {
      type: "text",
      media: [],
      location: { name: "Nameless Place" }, // no lat/lng
    });
    postIds.push(noCoords.id);
    expect(noCoords.location).toEqual({ name: "Nameless Place" });
  });

  test("createPost ignores malformed and nameless locations", async () => {
    const u = await makeUser();
    const badJson = await PostHelper.createPost(u.id, {
      type: "text",
      media: [],
      location: "{not json",
    });
    postIds.push(badJson.id);
    expect(badJson.location).toBeNull();

    const blankName = await PostHelper.createPost(u.id, {
      type: "text",
      media: [],
      location: { name: "   ", lat: "1", lng: "2" },
    });
    postIds.push(blankName.id);
    expect(blankName.location).toBeNull();
  });
});

describe("postHelpers — projections & visibility (Phase 7A)", () => {
  test("getPostById returns the exact 17-field projection with nested author", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { caption: "proj" });
    const found = await PostHelper.getPostById(post.id, u.id);

    expect(Object.keys(found).sort()).toEqual(
      [
        "id", "type", "caption", "media", "visibility", "commentsDisabled",
        "likesHidden", "location", "isDraft", "isDeleted", "likesCount",
        "commentsCount", "viewsCount", "savedCount", "createdAt", "updatedAt",
        "author",
      ].sort()
    );
    expect(Object.keys(found.author).sort()).toEqual(
      [...AUTHOR_KEYS, "accountStatus"].sort()
    );
    expect(found.authorId).toBeUndefined(); // not projected
  });

  test("getPostById rejects a non-UUID id without querying", async () => {
    expect(await PostHelper.getPostById("not-a-uuid")).toBeNull();
    expect(await PostHelper.getPostById("")).toBeNull();
  });

  test("getPostById treats a null viewer as a non-owner for drafts", async () => {
    const u = await makeUser();
    const draft = await makePost(u.id, { isDraft: true });
    expect(await PostHelper.getPostById(draft.id)).toBeNull(); // userId defaults to null
    expect(await PostHelper.getPostById(draft.id, u.id)).not.toBeNull();
  });

  test("getFeedPosts projects feed fields and excludes non-public posts", async () => {
    const u = await makeUser();
    const pub = await makePost(u.id, { caption: "feed" });
    await makePost(u.id, { visibility: "followers" }); // excluded

    const { items } = await PostHelper.getFeedPosts([u.id], { limit: 50 });
    expect(items.map((p) => p.id)).toEqual([pub.id]);

    expect(Object.keys(items[0]).sort()).toEqual(
      [
        "id", "type", "caption", "media", "likesCount", "commentsCount",
        "viewsCount", "savedCount", "commentsDisabled", "likesHidden",
        "createdAt", "author",
      ].sort()
    );
    expect(Object.keys(items[0].author).sort()).toEqual(AUTHOR_KEYS.slice().sort());
  });

  test("getFeedPosts spans multiple authors and returns an empty page for none", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const pa = await makePost(a.id);
    const pb = await makePost(b.id);

    const { items } = await PostHelper.getFeedPosts([a.id, b.id], { limit: 50 });
    expect(items.map((p) => p.id).sort()).toEqual([pa.id, pb.id].sort());

    expect(await PostHelper.getFeedPosts([], { limit: 50 })).toEqual({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  test("getUserPosts shows a private account's posts to an approved follower", async () => {
    const priv = await makeUser({ isPrivate: true });
    const post = await makePost(priv.id);

    const asFollower = await PostHelper.getUserPosts(priv.id, true, false, { limit: 18 });
    expect(asFollower.items.map((p) => p.id)).toEqual([post.id]);
  });

  test("getUserPosts projects its own narrower field set (no savedCount)", async () => {
    const u = await makeUser();
    await makePost(u.id);
    const { items } = await PostHelper.getUserPosts(u.id, false, true, { limit: 18 });

    expect(Object.keys(items[0]).sort()).toEqual(
      ["id", "type", "media", "caption", "likesCount", "commentsCount", "viewsCount", "createdAt", "author"].sort()
    );
    expect(items[0].savedCount).toBeUndefined();
  });

  test("getDraftPosts projects WITHOUT an author relation", async () => {
    const u = await makeUser();
    await makePost(u.id, { isDraft: true });
    const { items } = await PostHelper.getDraftPosts(u.id, { limit: 20 });

    expect(Object.keys(items[0]).sort()).toEqual(
      ["id", "type", "caption", "media", "likesCount", "commentsCount", "viewsCount", "createdAt"].sort()
    );
    expect(items[0].author).toBeUndefined();
  });

  test("getDraftPosts excludes deleted drafts and other users' drafts", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const mine = await makePost(u.id, { isDraft: true });
    await makePost(u.id, { isDraft: true, isDeleted: true });
    await makePost(other.id, { isDraft: true });

    const { items } = await PostHelper.getDraftPosts(u.id, { limit: 20 });
    expect(items.map((p) => p.id)).toEqual([mine.id]);
  });
});

describe("postHelpers — pagination semantics (Phase 7A)", () => {
  test("getFeedPosts caps the page at `limit` and reports hasMore/nextCursor", async () => {
    const u = await makeUser();
    for (let i = 0; i < 3; i++) {
      await makePost(u.id);
      await new Promise((r) => setTimeout(r, 5));
    }

    const page = await PostHelper.getFeedPosts([u.id], { limit: 2 });
    expect(page.items.length).toBe(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(page.items[1].id);

    const full = await PostHelper.getFeedPosts([u.id], { limit: 10 });
    expect(full.items.length).toBe(3);
    expect(full.hasMore).toBe(false);
    expect(full.nextCursor).toBeNull();
  });

  test("all three list helpers order newest-first and default their limits", async () => {
    const u = await makeUser();
    await makePost(u.id);
    await new Promise((r) => setTimeout(r, 5));
    const newest = await makePost(u.id);
    const draft = await makePost(u.id, { isDraft: true });

    const feed = await PostHelper.getFeedPosts([u.id]); // default limit 20
    expect(feed.items[0].id).toBe(newest.id);

    const userPosts = await PostHelper.getUserPosts(u.id, false, true); // default limit 18
    expect(userPosts.items[0].id).toBe(newest.id);

    const drafts = await PostHelper.getDraftPosts(u.id); // default limit 20
    expect(drafts.items[0].id).toBe(draft.id);
  });

  test("the beforeId cursor applies an id-less-than filter on every list helper", async () => {
    // PRESERVED ODDITY (carried forward byte-identical, NOT fixed): these
    // three helpers filter `id: { lt: beforeId }` while ordering by
    // `createdAt: "desc"`. Postgres UUIDs are random and uncorrelated with
    // insertion time, so which rows a cursored page returns is not
    // guaranteed — the same shape already documented for likeHelpers and
    // savedHelpers. Only the filter itself is asserted.
    const u = await makeUser();
    const ids = [];
    for (let i = 0; i < 3; i++) {
      ids.push((await makePost(u.id)).id);
      await new Promise((r) => setTimeout(r, 5));
    }
    const cursor = ids.slice().sort().at(-1); // the largest id

    const feed = await PostHelper.getFeedPosts([u.id], { beforeId: cursor, limit: 10 });
    for (const p of feed.items) expect(p.id < cursor).toBe(true);

    const userPosts = await PostHelper.getUserPosts(u.id, false, true, { beforeId: cursor, limit: 10 });
    for (const p of userPosts.items) expect(p.id < cursor).toBe(true);
  });
});

describe("postHelpers — mutations & ownership (Phase 7A)", () => {
  test("deletePost on a DRAFT does not decrement postsCount", async () => {
    const u = await makeUser();
    const draft = await makePost(u.id, { isDraft: true });
    const before = await postsCountOf(u.id);

    const deleted = await PostHelper.deletePost(draft.id, u.id);
    expect(deleted.id).toBe(draft.id);
    expect(await postsCountOf(u.id)).toBe(before); // unchanged
  });

  test("deletePost returns the pre-delete projection and is idempotent-null", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { media: [localMedia()] });

    const returned = await PostHelper.deletePost(post.id, u.id);
    expect(Object.keys(returned).sort()).toEqual(
      ["authorId", "id", "isDeleted", "isDraft", "media"].sort()
    );
    expect(returned.isDeleted).toBe(false); // state BEFORE the delete

    expect(await PostHelper.deletePost(post.id, u.id)).toBeNull(); // already deleted
    expect(await PostHelper.deletePost(MISSING, u.id)).toBeNull();
  });

  test("publishDraft enforces per-type media rules", async () => {
    const u = await makeUser();
    const emptyImage = await makePost(u.id, { isDraft: true, type: "image", media: [] });
    await expect(PostHelper.publishDraft(emptyImage.id, u.id)).rejects.toThrow(
      /at least one image/i
    );

    const badReel = await makePost(u.id, {
      isDraft: true,
      type: "reel",
      media: [localMedia("a"), localMedia("b")],
    });
    await expect(PostHelper.publishDraft(badReel.id, u.id)).rejects.toThrow(
      /exactly one video/i
    );
  });

  test("publishDraft returns null for an already-published or deleted post", async () => {
    const u = await makeUser();
    const published = await makePost(u.id, { media: [localMedia()] });
    expect(await PostHelper.publishDraft(published.id, u.id)).toBeNull();

    const deletedDraft = await makePost(u.id, { isDraft: true, isDeleted: true, media: [localMedia()] });
    expect(await PostHelper.publishDraft(deletedDraft.id, u.id)).toBeNull();
    expect(await PostHelper.publishDraft(MISSING, u.id)).toBeNull();
  });

  test("publishDraft returns the post with its author relation included", async () => {
    const u = await makeUser();
    const draft = await makePost(u.id, { isDraft: true, media: [localMedia()] });
    const published = await PostHelper.publishDraft(draft.id, u.id);

    expect(published.isDraft).toBe(false);
    expect(Object.keys(published.author).sort()).toEqual(AUTHOR_KEYS.slice().sort());
  });

  test("updatePost rejects an over-long caption and per-type media violations", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { type: "image", media: [localMedia()] });

    await expect(
      PostHelper.updatePost(post.id, u.id, { caption: "x".repeat(2201) })
    ).rejects.toThrow(/2200 characters/i);

    await expect(PostHelper.updatePost(post.id, u.id, { media: [] })).rejects.toThrow(
      /1–10 images/i
    );

    const reel = await makePost(u.id, { type: "reel", media: [localMedia()] });
    await expect(
      PostHelper.updatePost(reel.id, u.id, { media: [localMedia("a"), localMedia("b")] })
    ).rejects.toThrow(/exactly one video/i);

    const text = await makePost(u.id, { type: "text", media: [] });
    await expect(PostHelper.updatePost(text.id, u.id, { media: [localMedia()] })).rejects.toThrow(
      /cannot have media/i
    );
  });

  test("updatePost applies partial updates and coerces isDraft from a string", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { caption: "orig", type: "text" });

    const onlyDraft = await PostHelper.updatePost(post.id, u.id, { isDraft: "true" });
    expect(onlyDraft.isDraft).toBe(true);
    expect(onlyDraft.caption).toBe("orig"); // untouched

    const back = await PostHelper.updatePost(post.id, u.id, { isDraft: "false" });
    expect(back.isDraft).toBe(false); // any non-"true" string → false

    const empty = await PostHelper.updatePost(post.id, u.id, {});
    expect(empty.caption).toBe("orig");
    expect(Object.keys(empty.author).sort()).toEqual(AUTHOR_KEYS.slice().sort());
  });

  test("updatePost trims the caption and replaces media wholesale", async () => {
    const u = await makeUser();
    const post = await makePost(u.id, { type: "image", media: [localMedia("old")] });

    const updated = await PostHelper.updatePost(post.id, u.id, {
      caption: "  trimmed  ",
      media: [localMedia("new1"), localMedia("new2")],
    });

    expect(updated.caption).toBe("trimmed");
    expect(updated.media.map((m) => m.publicId)).toEqual(["new1", "new2"]);
    expect(updated.media.map((m) => m.order)).toEqual([0, 1]);
  });

  test("updatePost returns null for a deleted post", async () => {
    const u = await makeUser();
    const deleted = await makePost(u.id, { isDeleted: true });
    expect(await PostHelper.updatePost(deleted.id, u.id, { caption: "x" })).toBeNull();
    expect(await PostHelper.updatePost(MISSING, u.id, { caption: "x" })).toBeNull();
  });
});

describe("postHelpers — recordPostView (Phase 7A)", () => {
  test("a duplicate view is reported without re-incrementing (P2002 path)", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    const post = await makePost(author.id);

    const first = await PostHelper.recordPostView(post.id, viewer.id, {});
    expect(first).toEqual({ isNewView: true, selfView: false, viewsCount: 1 });

    const second = await PostHelper.recordPostView(post.id, viewer.id, {});
    expect(second).toEqual({ isNewView: false, selfView: false, viewsCount: 1 });

    expect(await prisma.postView.count({ where: { postId: post.id } })).toBe(1);
  });

  test("view options default when omitted and are persisted when supplied", async () => {
    const author = await makeUser();
    const v1 = await makeUser();
    const v2 = await makeUser();
    const post = await makePost(author.id);

    await PostHelper.recordPostView(post.id, v1.id, {});
    const defaults = await prisma.postView.findFirst({ where: { postId: post.id, userId: v1.id } });
    expect(defaults.source).toBe("modal");
    expect(defaults.duration).toBe(0);
    expect(defaults.device).toBe("desktop");

    await PostHelper.recordPostView(post.id, v2.id, { source: "feed", duration: 12, device: "mobile" });
    const supplied = await prisma.postView.findFirst({ where: { postId: post.id, userId: v2.id } });
    expect(supplied.source).toBe("feed");
    expect(supplied.duration).toBe(12);
    expect(supplied.device).toBe("mobile");
  });

  test("returns null for a missing or deleted post", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    const deleted = await makePost(author.id, { isDeleted: true });

    expect(await PostHelper.recordPostView(MISSING, viewer.id, {})).toBeNull();
    expect(await PostHelper.recordPostView(deleted.id, viewer.id, {})).toBeNull();
  });

  test("a self-view reports the current count without recording a row", async () => {
    const author = await makeUser();
    const post = await makePost(author.id);

    const result = await PostHelper.recordPostView(post.id, author.id, {});
    expect(result).toEqual({ isNewView: false, selfView: true, viewsCount: 0 });
    expect(await prisma.postView.count({ where: { postId: post.id } })).toBe(0);
  });

  test("multiple distinct viewers each increment the count", async () => {
    const author = await makeUser();
    const post = await makePost(author.id);

    for (let i = 0; i < 3; i++) {
      const v = await makeUser();
      await PostHelper.recordPostView(post.id, v.id, {});
    }

    const row = await prisma.post.findUnique({ where: { id: post.id }, select: { viewsCount: true } });
    expect(row.viewsCount).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY HAZARD REGRESSIONS (Phase 7A Milestone 7)
//
// Four ways a naive repository substitution would have silently changed
// behavior in this domain. None are "fixed" — each existing repository
// method is correct for its own contract; postHelpers must simply not use
// the obvious-looking one. Pinned so the constraints are executable.
// ─────────────────────────────────────────────────────────────────────────
describe("LikeRepository — findByUserAndTarget vs findExclusivePostLike (Phase 7A hazard)", () => {
  test("the two filters diverge for a like carrying more than one target", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    const post = await makePost(author.id);
    const comment = await prisma.comment.create({
      data: { postId: post.id, authorId: author.id, content: "c" },
    });

    // A row with BOTH postId and commentId set. postHelpers' original query
    // deliberately excluded these via `commentId: null, storyId: null`.
    await prisma.like.create({
      data: {
        likedById: viewer.id,
        postId: post.id,
        commentId: comment.id,
        targetModel: "Post",
        reaction: "❤️",
      },
    });

    // findByUserAndTarget filters on { likedById, postId } only — it MATCHES
    const loose = await likeRepository.findByUserAndTarget(viewer.id, "Post", post.id);
    expect(loose).not.toBeNull();

    // findExclusivePostLike adds commentId/storyId null — it does NOT match
    const strict = await likeRepository.findExclusivePostLike(viewer.id, post.id);
    expect(strict).toBeNull();

    // the helper must preserve the STRICT semantics
    expect(await PostHelper.findPostLikeByUser(viewer.id, post.id)).toBeNull();

    await prisma.like.deleteMany({ where: { postId: post.id } });
    await prisma.comment.deleteMany({ where: { id: comment.id } });
  });
});

describe("Post repositories — unbounded reads vs findMany cap (Phase 7A hazard)", () => {
  const CAP = 20; // toPrismaPagination()'s default limit

  test("findMany(filter) with no pagination silently caps at the default limit", async () => {
    const u = await makeUser();
    for (let i = 0; i < CAP + 3; i++) await makePost(u.id);

    const capped = await socialPostRepository.findMany({ authorId: u.id });
    expect(capped.length).toBe(CAP);

    // findManyWithCursor takes a RAW take, so the helper's limit+1 math holds
    const uncapped = await socialPostRepository.findManyWithCursor(
      { authorId: u.id, isDeleted: false },
      { take: CAP + 10, select: { id: true } }
    );
    expect(uncapped.length).toBe(CAP + 3);
  });

  test("getFeedPosts can return a page larger than the repository default cap", async () => {
    const u = await makeUser();
    for (let i = 0; i < CAP + 3; i++) await makePost(u.id);

    const { items, hasMore } = await PostHelper.getFeedPosts([u.id], { limit: CAP + 5 });
    expect(items.length).toBe(CAP + 3);
    expect(items.length).toBeGreaterThan(CAP); // no silent truncation
    expect(hasMore).toBe(false);
  });

  test("getSuperAdminIds and getAcceptedFollowingIds are unbounded", async () => {
    const follower = await makeUser();
    const expected = CAP + 3;
    for (let i = 0; i < expected; i++) {
      const target = await makeUser();
      await prisma.follow.create({
        data: { followerId: follower.id, followingId: target.id, status: "accepted" },
      });
    }

    const following = await PostHelper.getAcceptedFollowingIds(follower.id);
    expect(following.length).toBe(expected);
    expect(following.length).toBeGreaterThan(CAP);
    expect(Object.keys(following[0])).toEqual(["followingId"]); // projection preserved

    // the repository method behind it, directly
    const direct = await followRepository.findAllFollowingIds(follower.id, { status: "accepted" });
    expect(direct.length).toBe(expected);

    // super-admin lookup is likewise uncapped and projected
    const adminsBefore = (await userRepository.findAllByRole("super_admin", { select: { id: true } })).length;
    await makeUser({ role: "super_admin" });
    const adminsAfter = await PostHelper.getSuperAdminIds();
    expect(adminsAfter.length).toBe(adminsBefore + 1);
    expect(Object.keys(adminsAfter[0])).toEqual(["id"]);
  });

  test("findManyWithCursor passes its filter through verbatim, with no soft-delete scoping", async () => {
    // getDraftPosts needs isDraft:true; a repository that appended
    // isDeleted:false unconditionally would still work, but one that
    // overrode the caller's own predicates would not.
    const u = await makeUser();
    const draft = await makePost(u.id, { isDraft: true });
    await makePost(u.id, { isDraft: true, isDeleted: true });

    const rows = await socialPostRepository.findManyWithCursor(
      { authorId: u.id, isDraft: true, isDeleted: false },
      { take: 50, select: { id: true } }
    );
    expect(rows.map((r) => r.id)).toEqual([draft.id]);
  });
});

describe("SocialPostRepository — write-time include/select (Phase 7A hazard)", () => {
  test("create/update return the whole row by default but honour include and select", async () => {
    const u = await makeUser();

    // default — whole row, no author relation
    const plain = await socialPostRepository.create({ authorId: u.id, type: "text" });
    postIds.push(plain.id);
    expect(plain.author).toBeUndefined();
    expect(plain.authorId).toBe(u.id);

    // include — author attached, as createPost/publishDraft/updatePost need
    const withAuthor = await socialPostRepository.create(
      { authorId: u.id, type: "text" },
      { include: { author: { select: { id: true, username: true } } } }
    );
    postIds.push(withAuthor.id);
    expect(withAuthor.author.id).toBe(u.id);

    // select — narrow projection, as recordPostView's increment needs
    const narrowed = await socialPostRepository.update(
      plain.id,
      { viewsCount: { inc: 1 } },
      { select: { viewsCount: true } }
    );
    expect(Object.keys(narrowed)).toEqual(["viewsCount"]);
    expect(narrowed.viewsCount).toBe(1);
  });
});

describe("postHelpers — transaction semantics (Phase 7A)", () => {
  test("createPost's transaction rolls back the post when the count bump fails", async () => {
    const u = await makeUser();
    const before = await postsCountOf(u.id);
    const postsBefore = await prisma.post.count({ where: { authorId: u.id } });

    const err = await transactionRunner
      .run(async (tx) => {
        // mirrors createPost's first statement
        await socialPostRepository.create({ authorId: u.id, type: "text", caption: "rollback" }, { tx });
        // mirrors the postsCount bump, against a user that does not exist
        await userRepository.update(MISSING, { postsCount: { inc: 1 } }, { tx });
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    expect(err.code).toBe("P2025");
    expect(err.name).toBe("NotFoundError");

    expect(await prisma.post.count({ where: { authorId: u.id } })).toBe(postsBefore); // rolled back
    expect(await postsCountOf(u.id)).toBe(before);
  });

  test("recordPostView's transaction rolls back the view row when the increment fails", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    const post = await makePost(author.id);

    const err = await transactionRunner
      .run(async (tx) => {
        await postViewRepository.create({ postId: post.id, userId: viewer.id, source: "modal" }, { tx });
        await socialPostRepository.update(MISSING, { viewsCount: { inc: 1 } }, { tx });
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    expect(await prisma.postView.count({ where: { postId: post.id } })).toBe(0); // rolled back
    expect((await prisma.post.findUnique({ where: { id: post.id } })).viewsCount).toBe(0);
  });

  test("a duplicate PostView surfaces P2002 through the transaction boundary", async () => {
    // recordPostView's catch reads err.code === "P2002" to detect a lost
    // race. That code must survive normalization into DuplicateKeyError AND
    // the transactionRunner wrapper for the branch to still work.
    const author = await makeUser();
    const viewer = await makeUser();
    const post = await makePost(author.id);

    await PostHelper.recordPostView(post.id, viewer.id, {}); // row now exists

    const err = await transactionRunner
      .run(async (tx) => {
        await postViewRepository.create({ postId: post.id, userId: viewer.id, source: "modal" }, { tx });
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    expect(err.code).toBe("P2002");
    expect(err.name).toBe("DuplicateKeyError");
  });

  test("createPost commits both statements together end-to-end", async () => {
    const u = await makeUser();
    const before = await postsCountOf(u.id);

    const post = await PostHelper.createPost(u.id, { type: "text", caption: "atomic", media: [] });
    postIds.push(post.id);

    expect(await prisma.post.findUnique({ where: { id: post.id } })).not.toBeNull();
    expect(await postsCountOf(u.id)).toBe(before + 1);
  });
});
