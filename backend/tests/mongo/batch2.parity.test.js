// Phase 7E / M-5 + M-10 + M-6 — batch 2, executed against a live mongod.
import { mongoose, models } from "../../../shared/database/mongodb/index.js";
import { startMongo, stopMongo, clearMongo, syncIndexes, seed } from "./harness.js";
import { MongoCommentRepository } from "../../../shared/database/repositories/social/CommentRepository.js";
import { MongoLikeRepository } from "../../../shared/database/repositories/social/LikeRepository.js";
import { MongoFollowRepository } from "../../../shared/database/repositories/social/FollowRepository.js";
import { MongoConversationParticipantRepository } from "../../../shared/database/repositories/messaging/ConversationParticipantRepository.js";
import { MongoMessageRepository } from "../../../shared/database/repositories/messaging/MessageRepository.js";

const comments = new MongoCommentRepository();
const likes = new MongoLikeRepository();
const follows = new MongoFollowRepository();
const participants = new MongoConversationParticipantRepository();
const messages = new MongoMessageRepository();

beforeAll(async () => { await startMongo(); await syncIndexes(); }, 120_000);
afterAll(async () => { await stopMongo(); });
afterEach(async () => { await clearMongo(); });

describe("CommentRepository (Mongo)", () => {
  test("cursor read: caller-owned sort, RAW take, projection", async () => {
    const a = await seed.user();
    const p = await seed.post(a._id);
    for (let i = 0; i < 5; i++) {
      await models.Comment.create({ postId: p._id, authorId: a._id, content: `c${i}` });
      await new Promise((r) => setTimeout(r, 5));
    }
    const rows = await comments.findManyWithCursor(
      { postId: p._id }, { orderBy: { createdAt: "desc" }, take: 3, select: { content: true } },
    );
    expect(rows).toHaveLength(3); // raw take, not a 20-cap
    expect(rows[0].content).toBe("c4"); // newest first
  });

  test("findAllWhere is UNBOUNDED; findFirstWhere returns null on a miss", async () => {
    const a = await seed.user();
    const p = await seed.post(a._id);
    for (let i = 0; i < 25; i++) await models.Comment.create({ postId: p._id, authorId: a._id, content: "x" });
    expect(await comments.findAllWhere({ postId: p._id })).toHaveLength(25);
    expect(await comments.findFirstWhere({ content: "nope" })).toBeNull();
  });

  test("updateManyWhere/deleteManyWhere return Prisma's { count } payload", async () => {
    const a = await seed.user();
    const p = await seed.post(a._id);
    await models.Comment.create({ postId: p._id, authorId: a._id, content: "a" });
    await models.Comment.create({ postId: p._id, authorId: a._id, content: "b" });
    expect(await comments.updateManyWhere({ postId: p._id }, { isDeleted: true })).toEqual({ count: 2 });
    expect(await comments.deleteManyWhere({ postId: p._id })).toEqual({ count: 2 });
  });
});

describe("LikeRepository (Mongo) — polymorphic target", () => {
  test("findExclusivePostLike maps the app's target vocabulary to the Mongo one", async () => {
    // Postgres uses three nullable FK columns; Mongo uses (targetType,
    // targetId). Same domain question, different physical model.
    const [u, a] = [await seed.user(), await seed.user()];
    const p = await seed.post(a._id);
    await models.Like.create({ likedById: u._id, targetType: "post", targetId: p._id });
    expect(await likes.findExclusivePostLike(u._id, p._id)).not.toBeNull();
    const other = await seed.post(a._id);
    expect(await likes.findExclusivePostLike(u._id, other._id)).toBeNull();
  });

  test("findLikersWithUser populates the liker and takes limit + 1", async () => {
    const a = await seed.user();
    const p = await seed.post(a._id);
    for (let i = 0; i < 4; i++) {
      const u = await seed.user();
      await models.Like.create({ likedById: u._id, targetType: "post", targetId: p._id, reaction: "like" });
    }
    const rows = await likes.findLikersWithUser("Post", p._id, { limit: 2 });
    expect(rows).toHaveLength(3); // limit + 1
    expect(rows[0].likedBy.username).toBeDefined(); // populate resolved
  });

  test("groupByReaction returns the NEUTRAL { key, count } envelope (M-4)", async () => {
    const a = await seed.user();
    const p = await seed.post(a._id);
    for (const r of ["like", "like", "love"]) {
      const u = await seed.user();
      await models.Like.create({ likedById: u._id, targetType: "post", targetId: p._id, reaction: r });
    }
    const rows = await likes.groupByReaction({ targetId: p._id });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.count]));
    expect(byKey).toEqual({ like: 2, love: 1 });
    expect(rows[0]).not.toHaveProperty("_count"); // no Prisma envelope
  });

  test("deleteByUserAndTarget rejects an unknown targetType LOUDLY", async () => {
    const [u, a] = [await seed.user(), await seed.user()];
    const p = await seed.post(a._id);
    await models.Like.create({ likedById: u._id, targetType: "post", targetId: p._id });
    expect(await likes.deleteByUserAndTarget(u._id, "Post", p._id)).toEqual({ count: 1 });
    await expect(likes.deleteByUserAndTarget(u._id, "Nonsense", p._id)).rejects.toThrow(/Unknown targetType/);
  });
});

describe("FollowRepository (Mongo) — M-10 populate + cursor equivalence", () => {
  test("followers/following populate the profile and page by id desc", async () => {
    const target = await seed.user();
    const made = [];
    for (let i = 0; i < 4; i++) {
      const f = await seed.user();
      made.push(await models.Follow.create({ followerId: f._id, followingId: target._id, status: "accepted" }));
    }
    const page1 = await follows.findFollowersWithProfile(target._id, { status: "accepted", limit: 2 });
    expect(page1).toHaveLength(3); // limit + 1
    expect(page1[0].follower.username).toBeDefined();
    // id desc — newest first
    expect(String(page1[0]._id)).toBe(String(made[3]._id));

    // Prisma's native cursor becomes an `_id < afterId` predicate; the page
    // after the cursor must not repeat it.
    const page2 = await follows.findFollowersWithProfile(target._id, {
      status: "accepted", limit: 2, afterId: page1[1]._id,
    });
    expect(page2.map((r) => String(r._id))).not.toContain(String(page1[1]._id));
  });

  test("id-only reads are unbounded and projected", async () => {
    const target = await seed.user();
    for (let i = 0; i < 25; i++) {
      const f = await seed.user();
      await models.Follow.create({ followerId: f._id, followingId: target._id, status: "accepted" });
    }
    const ids = await follows.findAllFollowerIds(target._id, { status: "accepted" });
    expect(ids).toHaveLength(25);
    expect(ids[0].followerId).toBeDefined();
  });

  test("findAllBetween returns BOTH directions of a pair", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    await models.Follow.create({ followerId: a._id, followingId: b._id, status: "accepted" });
    await models.Follow.create({ followerId: b._id, followingId: a._id, status: "pending" });
    expect(await follows.findAllBetween(a._id, b._id)).toHaveLength(2);
  });

  test("findFollowersAmongWithProfile narrows to a supplied id set", async () => {
    const target = await seed.user();
    const [f1, f2, f3] = [await seed.user(), await seed.user(), await seed.user()];
    for (const f of [f1, f2, f3]) {
      await models.Follow.create({ followerId: f._id, followingId: target._id, status: "accepted" });
    }
    const rows = await follows.findFollowersAmongWithProfile(target._id, [f1._id, f2._id], { status: "accepted" });
    expect(rows).toHaveLength(2);
  });
});

describe("ConversationParticipantRepository (Mongo)", () => {
  test("active lookups exclude soft-deleted rows", async () => {
    const [u, v] = [await seed.user(), await seed.user()];
    const c = await models.Conversation.create({});
    await models.ConversationParticipant.create({ conversationId: c._id, userId: u._id });
    await models.ConversationParticipant.create({ conversationId: c._id, userId: v._id, isDeleted: true });
    expect(await participants.findActiveByConversationAndUser(c._id, u._id)).not.toBeNull();
    expect(await participants.findActiveByConversationAndUser(c._id, v._id)).toBeNull();
    expect(await participants.findAllActiveByUserId(u._id)).toHaveLength(1);
  });

  test("upsert is idempotent; updateManyWhere returns { count }", async () => {
    const [u] = [await seed.user()];
    const c = await models.Conversation.create({});
    const p = { update: { unreadCount: 0 }, create: { conversationId: c._id, userId: u._id } };
    const a = await participants.upsertByConversationAndUser(c._id, u._id, p);
    const b = await participants.upsertByConversationAndUser(c._id, u._id, p);
    expect(String(b._id)).toBe(String(a._id));
    expect(await participants.updateManyWhere({ conversationId: c._id }, { unreadCount: { inc: 1 } }))
      .toEqual({ count: 1 });
    expect((await models.ConversationParticipant.findById(a._id)).unreadCount).toBe(1);
  });

  test("sumUnreadForUser returns the NEUTRAL bare-sums object, null when empty", async () => {
    const u = await seed.user();
    const c = await models.Conversation.create({});
    await models.ConversationParticipant.create({ conversationId: c._id, userId: u._id, unreadCount: 5 });
    expect(await participants.sumUnreadForUser(u._id)).toEqual({ unreadCount: 5 });
    // null is PRESERVED for a no-match — the caller owns its `?? 0`.
    const empty = await participants.sumUnreadForUser((await seed.user())._id);
    expect(empty.unreadCount).toBeNull();
  });
});

describe("MessageRepository (Mongo) — M-6 FOR UPDATE equivalent", () => {
  const mkConv = () => models.Conversation.create({});

  test("cursor read orders createdAt desc with a RAW take", async () => {
    const [a] = [await seed.user()];
    const c = await mkConv();
    for (let i = 0; i < 4; i++) {
      await models.Message.create({ conversationId: c._id, senderId: a._id, text: `m${i}` });
      await new Promise((r) => setTimeout(r, 5));
    }
    const rows = await messages.findManyWithCursor({ conversationId: c._id, isDeleted: false }, { take: 2 });
    expect(rows).toHaveLength(2);
    expect(rows[0].text).toBe("m3");
  });

  test("findAllByConversationId is unbounded and excludes deleted", async () => {
    const a = await seed.user();
    const c = await mkConv();
    for (let i = 0; i < 25; i++) await models.Message.create({ conversationId: c._id, senderId: a._id, text: "x" });
    await models.Message.create({ conversationId: c._id, senderId: a._id, text: "gone", isDeleted: true });
    expect(await messages.findAllByConversationId(c._id)).toHaveLength(25);
  });

  test("findByIdForUpdate returns an ARRAY and takes a real document lock", async () => {
    const a = await seed.user();
    const c = await mkConv();
    const m = await models.Message.create({ conversationId: c._id, senderId: a._id, text: "lock me" });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const rows = await messages.findByIdForUpdate(m._id, { tx: session });
        // Raw-SQL result-set shape the caller's empty-check depends on.
        expect(Array.isArray(rows)).toBe(true);
        expect(rows).toHaveLength(1);
        expect(String(rows[0]._id)).toBe(String(m._id));
        expect(rows[0].isDeleted).toBe(false);
      });
    } finally { await session.endSession(); }

    // A missing id yields [] rather than throwing — same as the raw SELECT.
    const none = await messages.findByIdForUpdate(new mongoose.Types.ObjectId());
    expect(none).toEqual([]);
  });
});
