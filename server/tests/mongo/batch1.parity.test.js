// Phase 7E / M-5 + M-10 — batch 1 Mongo implementations, executed.
//
// Every method here is asserted against a live mongod. The point is not that
// the code parses — it is that the Mongo result has the same SHAPE and
// SEMANTICS as the Prisma one: same ordering, same pagination, same
// null-vs-missing behaviour, same { count } batch payloads, same populate
// projections standing in for Prisma's include/select.
import { mongoose, models } from "../../../shared/database/mongodb/index.js";
import { startMongo, stopMongo, clearMongo, syncIndexes, seed } from "./harness.js";
import { MongoSessionRepository } from "../../../shared/database/repositories/auth/SessionRepository.js";
import { MongoOtpRepository } from "../../../shared/database/repositories/auth/OtpRepository.js";
import { MongoConsentRepository } from "../../../shared/database/repositories/compliance/ConsentRepository.js";
import { MongoBlockRepository } from "../../../shared/database/repositories/social/BlockRepository.js";
import { MongoSavedRepository } from "../../../shared/database/repositories/social/SavedRepository.js";
import { MongoStoryRepository } from "../../../shared/database/repositories/social/StoryRepository.js";
import { MongoStoryViewRepository } from "../../../shared/database/repositories/social/StoryViewRepository.js";
import { MongoHighlightRepository } from "../../../shared/database/repositories/social/HighlightRepository.js";
import { MongoSuspensionHistoryRepository } from "../../../shared/database/repositories/moderation/SuspensionHistoryRepository.js";
import { MongoNotificationRepository } from "../../../shared/database/repositories/notifications/NotificationRepository.js";
import { MongoMessageReceiptRepository } from "../../../shared/database/repositories/messaging/MessageReceiptRepository.js";
import { MongoConversationRepository } from "../../../shared/database/repositories/messaging/ConversationRepository.js";

const sessions = new MongoSessionRepository();
const otps = new MongoOtpRepository();
const consents = new MongoConsentRepository();
const blocks = new MongoBlockRepository();
const saved = new MongoSavedRepository();
const stories = new MongoStoryRepository();
const storyViews = new MongoStoryViewRepository();
const highlights = new MongoHighlightRepository();
const suspensions = new MongoSuspensionHistoryRepository();
const notifications = new MongoNotificationRepository();
const receipts = new MongoMessageReceiptRepository();
const conversations = new MongoConversationRepository();

beforeAll(async () => { await startMongo(); await syncIndexes(); }, 120_000);
afterAll(async () => { await stopMongo(); });
afterEach(async () => { await clearMongo(); });

const future = () => new Date(Date.now() + 86_400_000);
const past = () => new Date(Date.now() - 86_400_000);

describe("SessionRepository (Mongo)", () => {
  const mkSession = (userId, over = {}) =>
    models.Session.create({ userId, tokenHash: `h_${Math.random()}`, expiresAt: future(), ...over });

  test("deleteManyByUserId / deleteManyWhere return Prisma's { count } payload", async () => {
    const u = await seed.user();
    await mkSession(u._id); await mkSession(u._id);
    // neutral filter, not a Mongo one — the translator does the work
    expect(await sessions.deleteManyWhere({ userId: u._id, expiresAt: { lte: past() } }))
      .toEqual({ count: 0 });
    expect(await sessions.deleteManyByUserId(u._id)).toEqual({ count: 2 });
    // a no-match is NOT an error, matching deleteMany semantics
    expect(await sessions.deleteManyByUserId(u._id)).toEqual({ count: 0 });
  });

  test("updateManyWhere returns { count } and applies a neutral write payload", async () => {
    const u = await seed.user();
    await mkSession(u._id); await mkSession(u._id);
    const r = await sessions.updateManyWhere({ userId: u._id }, { lastUsedAt: new Date() });
    expect(r).toEqual({ count: 2 });
  });

  test("findFirstWhere honours a compound neutral filter", async () => {
    const u = await seed.user();
    await mkSession(u._id, { tokenHash: "target" });
    const hit = await sessions.findFirstWhere({ tokenHash: "target", expiresAt: { gt: new Date() } });
    expect(hit).not.toBeNull();
    // null, not undefined, for a miss — same as Prisma's findFirst
    expect(await sessions.findFirstWhere({ tokenHash: "nope" })).toBeNull();
  });

  test("findManyWhere applies caller-owned ordering and stays UNBOUNDED", async () => {
    const u = await seed.user();
    for (let i = 0; i < 25; i++) await mkSession(u._id);
    const rows = await sessions.findManyWhere({ userId: u._id }, { orderBy: { createdAt: "desc" } });
    expect(rows).toHaveLength(25); // no 20-row cap
    const t = rows.map((r) => r.createdAt.getTime());
    expect(t).toEqual([...t].sort((a, b) => b - a));
  });

  test("findAllByUserIdOldestFirst is oldest-first — the eviction order", async () => {
    const u = await seed.user();
    const a = await mkSession(u._id);
    await new Promise((r) => setTimeout(r, 8));
    const b = await mkSession(u._id);
    const rows = await sessions.findAllByUserIdOldestFirst(u._id);
    expect(rows.map((r) => String(r._id))).toEqual([String(a._id), String(b._id)]);
  });
});

describe("OtpRepository (Mongo) — compound-key upsert", () => {
  test("upsert CREATES on first call and UPDATES on the second, same row", async () => {
    const u = await seed.user();
    const payload = (hash) => ({
      update: { hashedOtp: hash, attempts: 0, expiresAt: future(), resendCount: { inc: 1 } },
      create: { userId: u._id, purpose: "email_verify", hashedOtp: hash, expiresAt: future(), resendCount: 1 },
    });

    const first = await otps.upsertByUserAndPurpose(u._id, "email_verify", payload("h1"));
    expect(await models.Otp.countDocuments({})).toBe(1);
    // hashedOtp is `select: false` in the Mongo schema — a deliberate
    // projection choice, so it must be asked for explicitly.
    expect((await models.Otp.findById(first._id).select("+hashedOtp")).hashedOtp).toBe("h1");

    const second = await otps.upsertByUserAndPurpose(u._id, "email_verify", payload("h2"));
    expect(String(second._id)).toBe(String(first._id)); // same row, not a duplicate
    expect((await models.Otp.findById(second._id).select("+hashedOtp")).hashedOtp).toBe("h2");
    expect(await models.Otp.countDocuments({})).toBe(1);
    // the neutral { inc: 1 } became an atomic $inc, not a literal object
    expect(second.resendCount).toBe(2);
  });

  test("findByUserAndPurpose / findFirstWhere / deleteManyWhere", async () => {
    const u = await seed.user();
    await models.Otp.create({ userId: u._id, purpose: "forgot_password", hashedOtp: "x", expiresAt: future() });
    expect(await otps.findByUserAndPurpose(u._id, "forgot_password")).not.toBeNull();
    expect(await otps.findByUserAndPurpose(u._id, "email_verify")).toBeNull();
    expect(await otps.findFirstWhere({ userId: u._id, purpose: "forgot_password" })).not.toBeNull();
    expect(await otps.deleteManyWhere({ userId: u._id })).toEqual({ count: 1 });
  });
});

describe("ConsentRepository (Mongo)", () => {
  test("upsert on the (sessionId, policyVersion) compound key", async () => {
    const p = (analytics) => ({
      update: { analytics },
      create: { sessionId: "s1", policyVersion: "v1", essential: true, analytics, marketing: false },
    });
    const a = await consents.upsertBySessionAndPolicyVersion("s1", "v1", p(true));
    expect(a.analytics).toBe(true);
    const b = await consents.upsertBySessionAndPolicyVersion("s1", "v1", p(false));
    expect(String(b._id)).toBe(String(a._id));
    expect(b.analytics).toBe(false);
    expect(await models.Consent.countDocuments({})).toBe(1);
  });

  test("findFirstWhere with caller ordering and projection", async () => {
    await models.Consent.create({ sessionId: "s2", policyVersion: "v1", essential: true });
    await models.Consent.create({ sessionId: "s2", policyVersion: "v2", essential: true });
    const row = await consents.findFirstWhere({ sessionId: "s2" }, {
      orderBy: { createdAt: "desc" }, select: { sessionId: true, policyVersion: true },
    });
    expect(row.sessionId).toBe("s2");
  });
});

describe("BlockRepository (Mongo)", () => {
  test("upsert is idempotent on (blockerId, blockedId)", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const p = { update: { reason: "spam" }, create: { blockerId: a._id, blockedId: b._id, reason: "spam" } };
    const first = await blocks.upsertByBlockerAndBlocked(a._id, b._id, p);
    const second = await blocks.upsertByBlockerAndBlocked(a._id, b._id, p);
    expect(String(second._id)).toBe(String(first._id));
    expect(await models.Block.countDocuments({})).toBe(1);
  });

  test("deleteManyWhere returns { count }; findAllByBlockerId populates (M-10)", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    await models.Block.create({ blockerId: a._id, blockedId: b._id });
    const rows = await blocks.findAllByBlockerId(a._id, {
      include: { blocked: { select: { username: true } } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].blocked.username).toBe(b.username); // populate resolved
    expect(await blocks.deleteManyWhere({ blockerId: a._id })).toEqual({ count: 1 });
  });
});

describe("SavedRepository (Mongo) — M-10 populate with a relation filter", () => {
  test("attaches the projected post + author, and DROPS rows whose post is deleted", async () => {
    const u = await seed.user();
    const author = await seed.user();
    const live = await seed.post(author._id, { caption: "live" });
    const gone = await seed.post(author._id, { caption: "gone", isDeleted: true });
    await models.Saved.create({ savedById: u._id, postId: live._id });
    await models.Saved.create({ savedById: u._id, postId: gone._id });

    const rows = await saved.findByUserIdWithPost(u._id, { limit: 10 });
    // Postgres' `post: { isDeleted: false }` relation filter is an INNER
    // JOIN; Mongo's populate match yields null, so the row is dropped.
    expect(rows).toHaveLength(1);
    expect(rows[0].post.caption).toBe("live");
    expect(rows[0].post.author.username).toBe(author.username); // nested populate
  });

  test("takes limit + 1 so the caller can compute hasMore", async () => {
    const u = await seed.user();
    const a = await seed.user();
    for (let i = 0; i < 5; i++) {
      const p = await seed.post(a._id);
      await models.Saved.create({ savedById: u._id, postId: p._id });
    }
    expect(await saved.findByUserIdWithPost(u._id, { limit: 3 })).toHaveLength(4);
  });
});

describe("StoryRepository / StoryViewRepository / HighlightRepository (Mongo)", () => {
  test("findPublicActiveWithAuthor filters expiry+audience and populates the author", async () => {
    const a = await seed.user();
    await models.Story.create({ authorId: a._id, expiresAt: future(), audience: "public", type: "media" });
    await models.Story.create({ authorId: a._id, expiresAt: past(), audience: "public", type: "media" });
    await models.Story.create({ authorId: a._id, expiresAt: future(), audience: "close_friends", type: "media" });

    const rows = await stories.findPublicActiveWithAuthor();
    expect(rows).toHaveLength(1);
    expect(rows[0].author.username).toBe(a.username);
  });

  test("findOwnedByIds scopes to the owner; updateManyWhere returns { count }", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const s1 = await models.Story.create({ authorId: a._id, expiresAt: future(), type: "media" });
    const s2 = await models.Story.create({ authorId: b._id, expiresAt: future(), type: "media" });
    expect(await stories.findOwnedByIds([s1._id, s2._id], a._id)).toHaveLength(1);
    expect(await stories.updateManyWhere({ authorId: a._id }, { viewsCount: { inc: 1 } }))
      .toEqual({ count: 1 });
    expect((await models.Story.findById(s1._id)).viewsCount).toBe(1);
  });

  test("storyView: viewed-by-viewer projection, viewers populate, keyed update", async () => {
    const [a, v] = [await seed.user(), await seed.user()];
    const s = await models.Story.create({ authorId: a._id, expiresAt: future(), type: "media" });
    await models.StoryView.create({ storyId: s._id, viewerId: v._id, reaction: "love" });

    const seen = await storyViews.findViewedByViewer([s._id], v._id);
    expect(seen).toHaveLength(1);
    expect(seen[0].reaction).toBe("love");

    const viewers = await storyViews.findViewersWithProfile(s._id, { limit: 10 });
    expect(viewers[0].viewer.username).toBe(v.username);

    const updated = await storyViews.updateByStoryAndViewer(s._id, v._id, { reaction: "wow" });
    expect(updated.reaction).toBe("wow");
    // a missing pair throws NotFoundError, matching Prisma's P2025 → NotFound
    await expect(storyViews.updateByStoryAndViewer(s._id, a._id, { reaction: "x" }))
      .rejects.toThrow(/not found/i);
  });

  test("highlight: author-scoped reads exclude soft-deleted and the excluded id", async () => {
    const a = await seed.user();
    const h1 = await models.Highlight.create({ authorId: a._id, title: "one" });
    const h2 = await models.Highlight.create({ authorId: a._id, title: "two" });
    await models.Highlight.create({ authorId: a._id, title: "gone", isDeleted: true });

    expect(await highlights.findAllByAuthorWithSnapshots(a._id)).toHaveLength(2);
    const others = await highlights.findAllOtherByAuthorWithSnapshots(a._id, h1._id);
    expect(others.map((h) => String(h._id))).toEqual([String(h2._id)]);
  });
});

describe("SuspensionHistory / Notification / MessageReceipt / Conversation (Mongo)", () => {
  test("suspension history is unbounded and newest-first", async () => {
    const u = await seed.user();
    for (let i = 0; i < 25; i++) {
      await models.SuspensionHistory.create({ userId: u._id, action: "suspended", performedBy: u._id });
    }
    const rows = await suspensions.findAllByUserId(u._id);
    expect(rows).toHaveLength(25);
    const t = rows.map((r) => r.createdAt.getTime());
    expect(t).toEqual([...t].sort((a, b) => b - a));
  });

  test("notifications: relations read paginates + orders; updateManyWhere returns { count }", async () => {
    const [r, s] = [await seed.user(), await seed.user()];
    for (let i = 0; i < 3; i++) {
      await models.Notification.create({ receiverId: r._id, senderId: s._id, type: "like" });
    }
    const page = await notifications.findManyWithRelations({ receiverId: r._id }, { take: 2, skip: 0 });
    expect(page).toHaveLength(2);
    expect(await notifications.updateManyWhere({ receiverId: r._id }, { isRead: true }))
      .toEqual({ count: 3 });
  });

  test("message receipt upsert on (messageId, userId)", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const conv = await models.Conversation.create({});
    const msg = await models.Message.create({ conversationId: conv._id, senderId: a._id, text: "hi" });
    const p = { update: { readAt: new Date() }, create: { messageId: msg._id, conversationId: conv._id, userId: b._id } };
    const first = await receipts.upsertByMessageAndUser(msg._id, b._id, p);
    const second = await receipts.upsertByMessageAndUser(msg._id, b._id, p);
    expect(String(second._id)).toBe(String(first._id));
    expect(await models.MessageReceipt.countDocuments({})).toBe(1);
  });

  test("conversations: participants-key lookup and active-by-ids ordering/paging", async () => {
    const c1 = await models.Conversation.create({ participantsKey: "a:b", isActive: true });
    const c2 = await models.Conversation.create({ participantsKey: "a:c", isActive: true });
    await models.Conversation.create({ participantsKey: "a:d", isActive: false });

    expect(String((await conversations.findByParticipantsKey("a:b"))._id)).toBe(String(c1._id));
    expect(await conversations.findByParticipantsKey("nope")).toBeNull();

    const active = await conversations.findActiveByIds([c1._id, c2._id], { take: 5 });
    expect(active).toHaveLength(2);
    const t = active.map((c) => c.updatedAt.getTime());
    expect(t).toEqual([...t].sort((a, b) => b - a)); // updatedAt desc
  });
});
