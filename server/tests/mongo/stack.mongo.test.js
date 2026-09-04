// FINAL VERIFICATION — the application stack under DATABASE_PROVIDER=mongo.
//
// Every previous Mongo suite tested repositories DIRECTLY. This one goes
// through the real call path the application uses:
//
//     helper → config/repositories.js → Mongo repository → mongod
//
// That distinction is what makes it worth writing: the repository suites
// would stay green even if the composition root, the transaction runner or a
// helper's own filter/mutation shapes were wrong on Mongo. The provider is
// set BEFORE the composition root is imported (see beforeAll) because the
// root resolves it once at module-evaluation time.
import { mongoose, models } from "../../../shared/database/mongodb/index.js";
import { startMongo, stopMongo, clearMongo, syncIndexes, seed } from "./harness.js";

let repositories, transactionRunner;
let likeHelpers, savedHelpers, followHelpers, commentHelpers,
    notificationHelpers, messageHelpers, adminDashboardHelpers,
    adminReportHelpers, adminUserHelpers, exploreHelpers, otpHelpers,
    userHelpers, storyHelpers, consentHelpers, postHelpers, settingsHelpers,
    adminNotificationHelpers, adminAuditLogHelpers;

beforeAll(async () => {
  process.env.DATABASE_PROVIDER = "mongo";
  await startMongo();
  await syncIndexes();

  // Dynamic imports so the env var is set first — a static import would be
  // hoisted above the assignment and the root would resolve "prisma".
  repositories = await import("../../src/config/repositories.js");
  ({ transactionRunner } = await import("../../src/config/transaction.js"));

  likeHelpers          = await import("../../src/utils/likeHelpers.js");
  savedHelpers         = await import("../../src/utils/savedHelpers.js");
  followHelpers        = await import("../../src/utils/followHelpers.js");
  commentHelpers       = await import("../../src/utils/commentHelpers.js");
  notificationHelpers  = await import("../../src/utils/notificationHelpers.js");
  messageHelpers       = await import("../../src/utils/messageHelpers.js");
  adminDashboardHelpers= await import("../../src/utils/adminDashboardHelpers.js");
  adminReportHelpers   = await import("../../src/utils/adminReportHelpers.js");
  adminUserHelpers     = await import("../../src/utils/adminUserHelpers.js");
  exploreHelpers       = await import("../../src/utils/exploreHelpers.js");
  otpHelpers           = await import("../../src/utils/otpHelpers.js");
  userHelpers          = await import("../../src/utils/userHelpers.js");
  storyHelpers         = await import("../../src/utils/storyHelpers.js");
  consentHelpers       = await import("../../src/utils/consentHelpers.js");
  postHelpers          = await import("../../src/utils/postHelpers.js");
  settingsHelpers      = await import("../../src/utils/settingsHelpers.js");
  adminNotificationHelpers = await import("../../src/utils/adminNotificationHelpers.js");
  adminAuditLogHelpers = await import("../../src/utils/adminAuditLogHelpers.js");
}, 120_000);

afterAll(async () => {
  await stopMongo();
  delete process.env.DATABASE_PROVIDER;
});

afterEach(async () => { await clearMongo(); });

const future = () => new Date(Date.now() + 86_400_000);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

// ─────────────────────────────────────────────────────────────────────────
describe("provider factory — the whole root switches together", () => {
  test("every repository is Mongo-backed and the runner matches", () => {
    expect(repositories.DATABASE_PROVIDER).toBe("mongo");
    for (const [name, repo] of Object.entries(repositories)) {
      if (name === "DATABASE_PROVIDER" || typeof repo !== "object") continue;
      // `prisma` is exported by the root too and is deliberately null here —
      // that IS the Part 1 bootstrap fix, so asserting on it is the point
      // rather than an exemption from the check. Every repository is still
      // required to be Mongo-backed.
      if (repo === null) { expect(name).toBe("prisma"); continue; }
      expect(repo.constructor.name).toMatch(/^Mongo/);
    }
    // THE bug this file exists to catch: a Prisma runner beside Mongo
    // repositories would hand a Prisma tx to mongoose as a session.
    expect(transactionRunner.constructor.name).toBe("MongoTransaction");
  });
});

describe("helpers — reads, pagination and projections", () => {
  test("adminDashboard counts and sums run through the Mongo repositories", async () => {
    const a = await seed.user();
    await seed.post(a._id, { likesCount: 3, viewsCount: 7 });
    await seed.post(a._id, { likesCount: 2, viewsCount: 1, isDeleted: true });

    expect(await adminDashboardHelpers.countRegularUsers()).toBeGreaterThanOrEqual(1);
    // The helper's own filter carries isDeleted:false and stays
    // authoritative (includeDeleted:true only stops the repository
    // re-scoping it), so the soft-deleted post is excluded.
    expect(await adminDashboardHelpers.countPostsCreatedSince(daysAgo(1))).toBe(1);
    const likes = await adminDashboardHelpers.sumPostLikes();
    expect(likes.likesCount).toBe(3); // isDeleted:false only
  });

  test("adminUser list: neutral filter + ordering + raw page window", async () => {
    const mark = `stk_${Date.now()}`;
    for (let i = 0; i < 3; i++) await seed.user({ username: `${mark}_${i}` });
    const where = { username: { like: mark, caseInsensitive: true } };
    const page = await adminUserHelpers.findUsers(where, { createdAt: "asc" }, 0, 2);
    expect(page).toHaveLength(2);
    expect(await adminUserHelpers.countUsers(where)).toBe(3);
    expect(await adminUserHelpers.findUsers(where, { createdAt: "asc" }, 2, 2)).toHaveLength(1);
  });

  test("explore search: or + like + hasAny reach Mongo as $or/$regex/$in", async () => {
    const a = await seed.user();
    await seed.post(a._id, { caption: "premium MARBLE slab", hashtags: ["marble"], visibility: "public" });
    await seed.post(a._id, { caption: "granite", hashtags: ["granite"], visibility: "public" });
    const rows = await exploreHelpers.searchExplorePosts({ q: "marble", limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0].caption).toMatch(/MARBLE/);
  });

  test("explore applies the author predicate it used to silently drop", async () => {
    // The filter carries author: { accountStatus: { not: "deactivated" },
    // role: { not: "super_admin" } }. Postgres resolves it with a join. Mongo
    // has no join in find(), so the translator emits the dotted paths
    // `author.accountStatus` / `author.role` and the repository resolves them
    // against the populated author. Under the original strictQuery:true both
    // predicates were DISCARDED, so deactivated users' and super-admins'
    // posts were eligible for the feed.
    const live = await seed.user({ accountStatus: "active" });
    const gone = await seed.user({ accountStatus: "deactivated" });
    const boss = await seed.user({ accountStatus: "active", role: "super_admin" });
    for (const u of [live, gone, boss]) {
      await seed.post(u._id, { caption: "shared marble", hashtags: ["marble"], visibility: "public" });
    }
    const rows = await exploreHelpers.searchExplorePosts({ q: "marble", limit: 10 });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].author.id)).toBe(String(live._id));
  });

  test("author projections resolve — the six fields come back on one document", async () => {
    // The 18 relation-projection sites all ask for the same author block.
    // With users and profiles merged this is an ordinary populate again.
    const a = await seed.user({ accountStatus: "active", isVerifiedBadge: true });
    await seed.post(a._id, { caption: "author block", visibility: "public" });
    const [row] = await exploreHelpers.findExplorePosts({ type: "all", limit: 5 });
    expect(row.author).toMatchObject({
      username: a.username,
      fullName: a.fullName,
      accountStatus: "active",
      role: "user",
      isVerifiedBadge: true,
    });
  });

  test("saved list populates the post and drops deleted ones (M-10)", async () => {
    const [u, a] = [await seed.user(), await seed.user()];
    const live = await seed.post(a._id, { caption: "live" });
    const gone = await seed.post(a._id, { caption: "gone", isDeleted: true });
    await models.Saved.create({ savedById: u._id, postId: live._id });
    await models.Saved.create({ savedById: u._id, postId: gone._id });
    const res = await savedHelpers.getSavedPosts(u._id, { limit: 10 });
    const items = Array.isArray(res) ? res : (res.items ?? res.posts ?? res.saved ?? []);
    // The deleted post's row is dropped — Postgres does it with an INNER
    // JOIN, Mongo with a populate match + filter.
    expect(items.length).toBe(1);
  });
});

describe("helpers — transactions actually run on Mongo", () => {
  test("a helper transaction COMMITS through MongoTransaction", async () => {
    const [u, a] = [await seed.user(), await seed.user()];
    const p = await seed.post(a._id);
    const before = (await models.SocialPost.findById(p._id)).likesCount;

    await transactionRunner.run(async (tx) => {
      await repositories.socialPostRepository.update(p._id, { likesCount: { inc: 1 } }, { tx });
      await models.Like.create([{ likedById: u._id, targetType: "post", targetId: p._id }], { session: tx });
    });

    expect((await models.SocialPost.findById(p._id)).likesCount).toBe(before + 1);
    expect(await models.Like.countDocuments({ targetId: p._id })).toBe(1);
  });

  test("a helper transaction ROLLS BACK — no partial write survives", async () => {
    const a = await seed.user();
    const p = await seed.post(a._id);

    await expect(transactionRunner.run(async (tx) => {
      await repositories.socialPostRepository.update(p._id, { likesCount: { inc: 5 } }, { tx });
      throw new Error("boom");
    })).rejects.toThrow(/boom/);

    // The increment must be gone. If the runner were still PrismaTransaction
    // this assertion is what would fail.
    expect((await models.SocialPost.findById(p._id)).likesCount).toBe(0);
  });

  test("TransactionError preserves the cause's message on Mongo too", async () => {
    const err = await transactionRunner.run(async () => {
      throw new Error("distinct-cause-text");
    }).catch((e) => e);
    expect(err.message).toContain("distinct-cause-text");
  });
});

describe("helpers — writes, counters and upserts", () => {
  test("comment counters use atomic $inc via the neutral DSL", async () => {
    const a = await seed.user();
    const p = await seed.post(a._id);
    // signature is (client, postId) — `null` means "no transaction"
    await commentHelpers.incrementPostCommentsCount(null, p._id);
    await commentHelpers.incrementPostCommentsCount(null, p._id);
    expect((await models.SocialPost.findById(p._id)).commentsCount).toBe(2);
  });

  test("follow counters move on the user document", async () => {
    // These counters were the first symptom of the users/profiles split:
    // Milestone 2 put them on `profileSchema`, so
    // `userRepository.update(id, { followingCount: { inc: 1 } })` wrote a
    // path the User schema did not declare and mongoose dropped it in
    // silence — the follow succeeded and the counts never moved. They are
    // back on `users`, where Postgres has always kept them.
    const [a, b] = [await seed.user(), await seed.user({ isPrivate: false })];
    await followHelpers.sendFollowRequest(a._id, b._id, false); // public → auto-accept

    expect(await models.Follow.countDocuments({ followerId: a._id, followingId: b._id })).toBe(1);
    expect((await models.User.findById(a._id)).followingCount).toBe(1);
    expect((await models.User.findById(b._id)).followersCount).toBe(1);
  });

  test("unfollow decrements the counters back down", async () => {
    const [a, b] = [await seed.user(), await seed.user({ isPrivate: false })];
    await followHelpers.sendFollowRequest(a._id, b._id, false);
    await followHelpers.unfollow(a._id, b._id);

    expect(await models.Follow.countDocuments({ followerId: a._id, followingId: b._id })).toBe(0);
    expect((await models.User.findById(a._id)).followingCount).toBe(0);
    expect((await models.User.findById(b._id)).followersCount).toBe(0);
  });

  test("otp upsert round-trips through the helper on Mongo", async () => {
    const u = await seed.user();
    const { otp, otpDoc } = await otpHelpers.generateOtp(u._id, "email_verify");
    expect(otp).toMatch(/^\d{6}$/);
    expect(otpDoc).toBeTruthy();
    expect(await models.Otp.countDocuments({ userId: u._id })).toBe(1);
    // Regenerating immediately is REFUSED by the resend cooldown — that
    // guard is helper logic and must behave the same on Mongo.
    await expect(otpHelpers.generateOtp(u._id, "email_verify")).rejects.toMatchObject({ statusCode: 429 });
    expect(await models.Otp.countDocuments({ userId: u._id })).toBe(1);
  });

  test("consent upsert is idempotent on its compound key", async () => {
    const a = await consentHelpers.upsertConsent({
      sessionId: "sess-1", policyVersion: "v1", essential: true, analytics: true, marketing: false,
    });
    const b = await consentHelpers.upsertConsent({
      sessionId: "sess-1", policyVersion: "v1", essential: true, analytics: false, marketing: false,
    });
    expect(String(b._id)).toBe(String(a._id));
    expect(await models.Consent.countDocuments({})).toBe(1);
  });
});

describe("helpers — aggregation pipelines (M-4 + M-6) end to end", () => {
  test("report groupBys return neutral rows through the helper", async () => {
    const r = await seed.user();
    for (const status of ["pending", "pending", "resolved_dismissed"]) {
      await models.Report.create({
        reportedById: r._id, targetType: "post", targetId: new mongoose.Types.ObjectId(),
        reason: "spam", status,
      });
    }
    const rows = await adminReportHelpers.groupReportsByStatus();
    const byKey = Object.fromEntries(rows.map((x) => [x.key, x.count]));
    expect(byKey.pending).toBe(2);
    expect(rows[0]).not.toHaveProperty("_count");
  });

  test("M-6 daily trend runs as a pipeline through the helper", async () => {
    const r = await seed.user();
    await models.Report.create({
      reportedById: r._id, targetType: "post", targetId: new mongoose.Types.ObjectId(),
      reason: "spam", createdAt: daysAgo(1),
    });
    const rows = await adminReportHelpers.findReportDailyTrend(daysAgo(5));
    expect(rows[0]).toHaveProperty("_id");
    expect(Number.isInteger(rows[0].count)).toBe(true);
  });

  test("M-6 dashboard time-series run through their helpers", async () => {
    const a = await seed.user({ createdAt: daysAgo(1) });
    await seed.post(a._id, { type: "media", createdAt: daysAgo(1) });
    const newUsers = await adminDashboardHelpers.findNewUsersTimeSeries("YYYY-MM-DD", daysAgo(5));
    expect(newUsers[0]).toHaveProperty("newUsers");
    const byType = await adminDashboardHelpers.findPostsByTypeTimeSeries("YYYY-MM-DD", daysAgo(5));
    expect(byType[0]).toHaveProperty("type");
    const engagement = await adminDashboardHelpers.findEngagementTimeSeries(daysAgo(5));
    expect(Array.isArray(engagement)).toBe(true);
  });
});

describe("helpers — notifications and messaging", () => {
  test("notification list + unread count through the helpers", async () => {
    const [r, s] = [await seed.user(), await seed.user()];
    for (let i = 0; i < 3; i++) {
      await models.Notification.create({ receiverId: r._id, senderId: s._id, type: "like" });
    }
    const inbox = await notificationHelpers.getInbox(r._id, { limit: 10 });
    const items = Array.isArray(inbox) ? inbox : (inbox.items ?? inbox.notifications ?? []);
    expect(items.length).toBe(3);
    expect(await notificationHelpers.getUnreadCount(r._id)).toBe(3);
  });

  test("unread total sums through ConversationParticipant on Mongo", async () => {
    const u = await seed.user();
    const c = await models.Conversation.create({});
    await models.ConversationParticipant.create({ conversationId: c._id, userId: u._id, unreadCount: 4 });
    expect(await messageHelpers.getTotalUnread(u._id)).toBe(4);
    // null-safe for a user with no rows — the `?? 0` contract
    expect(await messageHelpers.getTotalUnread((await seed.user())._id)).toBe(0);
  });
});

describe("authentication path on Mongo", () => {
  test("session lifecycle: create, lookup by hash, evict, revoke", async () => {
    const u = await seed.user();
    const raw = await userHelpers.generateRefreshToken(
      { id: u._id }, "device", "127.0.0.1", false,
    );
    expect(typeof raw).toBe("string");
    expect(await models.Session.countDocuments({ userId: u._id })).toBe(1);

    const found = await userHelpers.findByRefreshToken(raw);
    expect(found).not.toBeNull();

    await userHelpers.removeAllRefreshTokens(u._id);
    expect(await models.Session.countDocuments({ userId: u._id })).toBe(0);
  });

  test("the device cap evicts oldest-first on Mongo", async () => {
    const u = await seed.user();
    // NOTE: tokens must be issued at least a second apart. jwt.sign() puts a
    // second-resolution `iat` in the payload, so two tokens minted for the
    // same user within one second are BYTE-IDENTICAL and collide on the
    // unique tokenHash. That is the pre-existing refresh-token collision the
    // Phase 7A audit flagged — it is not a Mongo regression (Postgres has
    // the same unique constraint) and is deliberately not "fixed" here.
    for (let i = 0; i < 12; i++) {
      await userHelpers.generateRefreshToken({ id: u._id }, `d${i}`, "1.1.1.1", i % 2 === 0);
      await new Promise((r) => setTimeout(r, 1100));
    }
    // This assertion used to read `toBe(1)`. The helper evicts with
    // `deleteManyWhere({ id: { in: [...] } })`; `id` is a mongoose virtual,
    // mongoose was configured `strictQuery: true`, and so the ONLY predicate
    // in that filter was stripped and the call deleted every session the user
    // had. A probe confirmed it directly: two ids in, five of five documents
    // deleted, `deletedCount: 5`, no error.
    //
    // Two changes close it. toMongoFilter now emits `_id` for the neutral key
    // `id`, and strictQuery is "throw" so a future unrecognised path cannot
    // quietly widen a delete again.
    const kept = await models.Session.countDocuments({ userId: u._id });
    expect(kept).toBe(10); // MAX_DEVICES — same as Postgres.
  }, 60_000);

  test("an id-list delete removes exactly the listed rows", async () => {
    // The narrow regression for the bug above, without the 13-second wait.
    const u = await seed.user();
    const made = [];
    for (let i = 0; i < 5; i += 1) {
      made.push(
        await models.Session.create({
          userId: u._id,
          tokenHash: `dev-cap-${i}`,
          expiresAt: new Date(Date.now() + 3_600_000),
          lastUsedAt: new Date(),
        }),
      );
    }
    const { count } = await repositories.sessionRepository.deleteManyWhere({
      id: { in: made.slice(0, 2).map((d) => d.id) },
    });
    expect(count).toBe(2);
    expect(await models.Session.countDocuments({ userId: u._id })).toBe(3);
  });

  test("a filter naming a path the schema does not declare throws", async () => {
    // strictQuery: "throw". The point is that this is LOUD — under the old
    // `true` setting the predicate vanished and the query ran unfiltered.
    await expect(
      models.Session.countDocuments({ noSuchField: "x" }),
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("ownership checks — ObjectId is not a string", () => {
  // Postgres ids are uuid STRINGS, so `post.authorId !== userId` worked. On
  // Mongo the left side is an ObjectId, and `ObjectId !== "abc"` is true for
  // every value — so 24 ownership guards across eight helpers rejected the
  // legitimate owner (and two dedupe checks stopped deduping). All now
  // compare String() to String(), which is a no-op on Postgres.
  test("an author can delete their own post; a stranger cannot", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const p = await seed.post(a._id);

    expect(await postHelpers.deletePost(p._id, b._id)).toBeNull();
    expect((await models.SocialPost.findById(p._id)).isDeleted).toBe(false);

    expect(await postHelpers.deletePost(p._id, a._id)).toBeTruthy();
    expect((await models.SocialPost.findById(p._id)).isDeleted).toBe(true);
  });

  test("an author can delete their own story; a stranger cannot", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const s = await models.Story.create({ authorId: a._id, expiresAt: future(), type: "media" });

    expect(await storyHelpers.deleteStory(s._id, b._id)).toBeNull();
    expect((await models.Story.findById(s._id)).isDeleted).toBe(false);

    expect(await storyHelpers.deleteStory(s._id, a._id)).toBeTruthy();
    expect((await models.Story.findById(s._id)).isDeleted).toBe(true);
  });

  test("a notification can only be read by its receiver", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const n = await models.Notification.create({
      receiverId: a._id, senderId: b._id, type: "follow",
    });
    expect(await notificationHelpers.markOneAsRead(n._id, b._id)).toBeNull();
    expect(await notificationHelpers.markOneAsRead(n._id, a._id)).toBeTruthy();
    expect((await models.Notification.findById(n._id)).isRead).toBe(true);
  });
});

describe("story soft-delete round-trips through deactivate/reactivate", () => {
  test("deactivation hides stories and reactivation brings them back", async () => {
    // The case the TTL-only schema could not express: reactivation restores
    // exactly the stories deactivation hid.
    const u = await seed.user();
    const s = await models.Story.create({ authorId: u._id, expiresAt: future(), type: "media" });

    await settingsHelpers.deactivateAccount(u._id);
    expect((await models.Story.findById(s._id)).isDeleted).toBe(true);

    await settingsHelpers.reactivateAccount(u._id);
    expect((await models.Story.findById(s._id)).isDeleted).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("map sellers, people search, admin notifications", () => {
  test("findMapSellers returns only located, active, non-admin users", async () => {
    // findUsersWithLocation used to throw on Mongo: Milestone 2 had moved
    // `location` off the users collection into `locations`/`companies`, which
    // nothing read. It is back on the user document, so the predicate is a
    // plain one and this is an ordinary filtered read again.
    const located = await seed.user({
      accountStatus: "active", fullName: "Marble Traders",
      businessCategory: "marble", location: { city: "Jaipur" },
    });
    await seed.user({ accountStatus: "active", fullName: "No Pin Co" }); // no location
    await seed.user({ accountStatus: "deactivated", fullName: "Gone Co", location: { city: "Jaipur" } });
    await seed.user({ accountStatus: "active", role: "super_admin", fullName: "Boss", location: { city: "Jaipur" } });

    const rows = await userHelpers.findMapSellers({});
    expect(rows).toHaveLength(1);
    expect(String(rows[0]._id ?? rows[0].id)).toBe(String(located._id));

    // The caller's extra conditions are ANDed onto the location predicate.
    expect(await userHelpers.findMapSellers({ category: "granite" })).toHaveLength(0);
    expect(await userHelpers.findMapSellers({ q: "marble" })).toHaveLength(1);
  });

  test("people search matches username OR fullName", async () => {
    // Mongo could only match username while fullName lived on `profiles`.
    const mark = `ppl${Date.now()}`;
    await seed.user({ accountStatus: "active", username: `${mark}_uname`, fullName: "Unrelated Person" });
    await seed.user({ accountStatus: "active", fullName: `${mark} Stone Works` });
    await seed.user({ accountStatus: "active", role: "super_admin", fullName: `${mark} Admin` });

    const rows = await userHelpers.searchUsers(mark, 20);
    expect(rows).toHaveLength(2); // both matches, super_admin excluded
  });

  test("admin notifications write, read and mark-all-read on Mongo", async () => {
    // These four writes used to throw. See the Mongo class for why the
    // ownership objection did not survive tracing the actual write path.
    await adminNotificationHelpers.createAdminNotification({
      type: "admin_new_user", label: "New user registered", meta: { userId: "u1" },
    });
    await adminNotificationHelpers.createAdminNotification({
      type: "admin_new_report", label: "New report submitted", meta: {},
    });

    expect(await adminNotificationHelpers.countUnreadAdminNotifications()).toBe(2);
    const feed = await adminNotificationHelpers.findAdminNotifications(10);
    expect(feed).toHaveLength(2);
    expect(feed[0].audience).toBe("admin");

    expect(await adminNotificationHelpers.markAllAdminNotificationsRead()).toEqual({ count: 2 });
    expect(await adminNotificationHelpers.countUnreadAdminNotifications()).toBe(0);
  });

  test("admin writes never touch a user notification", async () => {
    // Every admin write is scoped to { audience: "admin" }, so the shared
    // collection cannot be crossed even by mistake.
    const [a, b] = [await seed.user(), await seed.user()];
    await models.Notification.create({ receiverId: a._id, senderId: b._id, type: "follow" });

    await adminNotificationHelpers.createAdminNotification({ type: "admin_new_user", label: "x", meta: {} });
    await adminNotificationHelpers.markAllAdminNotificationsRead();

    const userRow = await models.Notification.findOne({ receiverId: a._id });
    expect(userRow.isRead).toBe(false); // untouched by markAllRead
    expect(await adminNotificationHelpers.countUnreadAdminNotifications()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("comment and notification author blocks, and compound sorts", () => {
  test("the comment list returns its author inline, newest first", async () => {
    const author = await seed.user({ fullName: "Slab Co" });
    const post = await seed.post(author._id);
    const mk = (content, ageMin) => models.Comment.create({
      postId: post._id, authorId: author._id, content, status: "active",
      createdAt: new Date(Date.now() - ageMin * 60_000),
    });
    await mk("oldest", 30);
    await mk("newest", 1);

    const { comments } = await commentHelpers.getTopLevelComments(post._id, { limit: 10 });
    expect(comments.map((c) => c.content)).toEqual(["newest", "oldest"]);
    // The author block resolves rather than coming back undefined.
    expect(comments[0].author).toMatchObject({
      username: author.username,
      fullName: "Slab Co",
    });
  });

  test("a compound orderBy keeps every key, in order", async () => {
    // getReplies sorts [{isPinned desc}, {createdAt desc}, {id desc}] —
    // Prisma's ARRAY form. toMongoSort read an array as a plain object,
    // found no `.field`, and fell back to { createdAt: -1 }: the pin
    // ordering AND the id tiebreaker were both dropped, silently.
    const author = await seed.user();
    const post = await seed.post(author._id);
    const parent = await models.Comment.create({
      postId: post._id, authorId: author._id, content: "parent", status: "active",
    });
    const mk = (content, isPinned, ageMin) => models.Comment.create({
      postId: post._id, authorId: author._id, parentCommentId: parent._id,
      content, isPinned, status: "active",
      createdAt: new Date(Date.now() - ageMin * 60_000),
    });
    await mk("plain old", false, 30);
    await mk("plain new", false, 1);
    await mk("pinned but oldest", true, 60);

    const { replies } = await commentHelpers.getReplies(parent._id, { limit: 10 });
    expect(replies.map((r) => r.content))
      .toEqual(["pinned but oldest", "plain new", "plain old"]);
  });

  test("the notification inbox returns its sender inline", async () => {
    const [me, them] = [await seed.user({ fullName: "Sender Name" }), await seed.user()];
    await models.Notification.create({ receiverId: them._id, senderId: me._id, type: "follow" });

    const rows = await notificationHelpers.getInbox(them._id, 1, 20);
    const list = Array.isArray(rows) ? rows : rows.notifications ?? rows.data;
    expect(list).toHaveLength(1);
    expect(list[0].sender).toMatchObject({
      username: me.username,
      fullName: "Sender Name",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("relation aliases — every populated relation lands where callers look", () => {
  // Mongo stores the FK as `followerId`/`blockedId`/`viewerId`, and
  // populate("followerId") attaches the joined document to THAT name. The
  // callers all read `.follower` / `.blocked` / `.viewer`, matching Prisma —
  // so every one of these came back undefined while the query itself
  // succeeded. Alias virtuals give each relation its Prisma name.
  test("follower and following resolve on the follow graph", async () => {
    const [a, b] = [await seed.user({ fullName: "Follower A" }), await seed.user({ isPrivate: false })];
    await followHelpers.sendFollowRequest(a._id, b._id, false);

    // The controller renders `f.follower` (follow.controller.js:121).
    const { followers } = await followHelpers.getFollowers(b._id, null, 10);
    expect(followers[0].follower.fullName).toBe("Follower A");
  });

  test("blocked resolves on the block list", async () => {
    const [me, them] = [await seed.user(), await seed.user({ fullName: "Blocked One" })];
    await models.Block.create({ blockerId: me._id, blockedId: them._id });

    // user.controller.js:207 renders `b.blocked`.
    const rows = await userHelpers.findBlockedUsers(me._id);
    expect(rows[0].blocked.fullName).toBe("Blocked One");
  });

  test("viewer resolves on story views", async () => {
    const [author, watcher] = [await seed.user(), await seed.user({ fullName: "Watcher" })];
    const story = await models.Story.create({ authorId: author._id, expiresAt: future(), type: "media" });
    await models.StoryView.create({ storyId: story._id, viewerId: watcher._id });

    const viewers = await storyHelpers.getStoryViewers(story._id, author._id);
    const list = viewers?.viewers ?? viewers;
    expect(list[0].viewer.fullName).toBe("Watcher");
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("write flows end-to-end on Mongo", () => {
  // The read paths were already covered above. These are the CREATE paths —
  // the ones a cutover smoke test would exercise first, and the ones where a
  // dropped field or an unwired mutation shows up as data that never arrives.
  test("createComment persists and bumps the post's comment counter", async () => {
    const [author, commenter] = [await seed.user(), await seed.user()];
    const post = await seed.post(author._id);

    const c = await commentHelpers.createComment({
      postId: post._id, authorId: commenter._id, content: "How thick is this slab?",
    });
    expect(c).toBeTruthy();
    expect(await models.Comment.countDocuments({ postId: post._id })).toBe(1);

    // The author block is requested via `include` on create.
    const stored = await models.Comment.findById(c._id ?? c.id).lean();
    expect(stored.content).toBe("How thick is this slab?");
    expect(String(stored.authorId)).toBe(String(commenter._id));
    expect(stored.depth).toBe(0);
  });

  test("a reply gets depth 1 and increments its parent's repliesCount", async () => {
    const [author, commenter] = [await seed.user(), await seed.user()];
    const post = await seed.post(author._id);
    const parent = await commentHelpers.createComment({
      postId: post._id, authorId: commenter._id, content: "parent",
    });
    const parentId = parent._id ?? parent.id;

    const reply = await commentHelpers.createComment({
      postId: post._id, authorId: author._id, content: "reply", parentCommentId: parentId,
    });
    const storedReply = await models.Comment.findById(reply._id ?? reply.id).lean();
    expect(storedReply.depth).toBe(1);
    expect((await models.Comment.findById(parentId).lean()).repliesCount).toBe(1);
  });

  test("toggleLike likes then unlikes, moving the counter both ways", async () => {
    const [author, liker] = [await seed.user(), await seed.user()];
    const post = await seed.post(author._id);

    // `updateParentCount` is opt-in — the controller passes it. Without it
    // the like row is still written but the denormalised counter is left to
    // the caller, which is the existing Postgres contract.
    const opts = { updateParentCount: true };

    await likeHelpers.toggleLike(liker._id, post._id, "Post", "❤️", opts);
    // "Post" in, "post" stored: the interface uses the app-wide capitalised
    // convention, the Mongo enum is lower-case, and the repository translates.
    expect(await models.Like.countDocuments({ targetType: "post", targetId: post._id })).toBe(1);
    expect((await models.SocialPost.findById(post._id).lean()).likesCount).toBe(1);

    await likeHelpers.toggleLike(liker._id, post._id, "Post", "❤️", opts);
    expect(await models.Like.countDocuments({ targetType: "post", targetId: post._id })).toBe(0);
    expect((await models.SocialPost.findById(post._id).lean()).likesCount).toBe(0);
  });

  test("the like unique index makes a double-like impossible", async () => {
    // {likedById, targetType, targetId} is unique. Two concurrent likes must
    // not be able to produce two rows.
    const [author, liker] = [await seed.user(), await seed.user()];
    const post = await seed.post(author._id);
    await models.Like.create({ likedById: liker._id, targetType: "post", targetId: post._id });
    await expect(
      models.Like.create({ likedById: liker._id, targetType: "post", targetId: post._id })
    ).rejects.toThrow();
  });

  test("createTextStory writes a story the feed can read back", async () => {
    const u = await seed.user();
    const s = await storyHelpers.createTextStory(u._id, "Fresh stock", "#fff", "center", "public");
    const id = s._id ?? s.id;
    const stored = await models.Story.findById(id).lean();
    expect(stored.type).toBe("text");
    expect(stored.isDeleted).toBe(false);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(String(stored.authorId)).toBe(String(u._id));
  });

  test("story view records the viewer and the story feed excludes deleted", async () => {
    const u = await seed.user({ isPrivate: false });
    const live = await models.Story.create({
      authorId: u._id, expiresAt: future(), type: "media", audience: "public",
    });
    await models.Story.create({
      authorId: u._id, expiresAt: future(), type: "media", audience: "public",
      isDeleted: true, deletedAt: new Date(),
    });
    const feed = await repositories.storyRepository.findPublicActiveWithAuthor();
    expect(feed).toHaveLength(1);
    expect(String(feed[0]._id)).toBe(String(live._id));
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("admin audit log on Mongo", () => {
  // The last helper family with no Mongo coverage, found by the final audit's
  // flow-by-flow sweep. It matters disproportionately: the audit log is the
  // moderation record, and its `performedBy` block is the one relation the
  // admin UI shows for every row.
  async function seedLogs(admin) {
    const rows = [
      { action: "post.delete", category: "social" },
      { action: "post.delete", category: "social" },
      { action: "user.suspend", category: "admin" },
    ];
    for (const r of rows) {
      await models.AuditLog.create({
        performedById: admin._id, performedByName: admin.fullName,
        action: r.action, category: r.category, ipAddress: "1.2.3.4",
      });
    }
  }

  test("the log list resolves its performedBy block and pages", async () => {
    const admin = await seed.user({ role: "admin", fullName: "Admin One" });
    await seedLogs(admin);

    const page = await adminAuditLogHelpers.findAuditLogs({}, 0, 2);
    expect(page).toHaveLength(2);
    // populate("performedBy") — the alias virtual, not the raw FK.
    expect(page[0].performedBy).toMatchObject({
      username: admin.username, fullName: "Admin One", role: "admin",
    });
    expect(await adminAuditLogHelpers.countAuditLogs({})).toBe(3);
  });

  test("a single log resolves its admin too", async () => {
    const admin = await seed.user({ role: "admin", fullName: "Admin One" });
    await seedLogs(admin);
    const [any] = await models.AuditLog.find({}).limit(1);
    const one = await adminAuditLogHelpers.findAuditLogById(any._id);
    expect(one.performedBy.username).toBe(admin.username);
  });

  test("the audit stat groupings return the neutral envelope", async () => {
    const admin = await seed.user({ role: "admin" });
    await seedLogs(admin);
    const since = daysAgo(7);

    const byCategory = await adminAuditLogHelpers.groupAuditLogsByCategory(since);
    const byAction = await adminAuditLogHelpers.groupAuditLogsByAction(since);
    for (const rows of [byCategory, byAction]) {
      expect(Array.isArray(rows)).toBe(true);
      for (const r of rows) expect(Object.keys(r).sort()).toEqual(["count", "key"]);
    }
    expect(byCategory.find((r) => r.key === "social").count).toBe(2);
    expect(byAction.find((r) => r.key === "post.delete").count).toBe(2);
  });

  test("daily activity runs as a pipeline, not raw SQL", async () => {
    const admin = await seed.user({ role: "admin" });
    await seedLogs(admin);
    const rows = await adminAuditLogHelpers.findAuditLogDailyActivity(daysAgo(7));
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });
});
