// PHASE 8 — the migration dry run, as a test.
//
// This is the rehearsal the cutover depends on, and it lives in the Postgres
// project because it needs BOTH databases at once: the embedded Postgres this
// project's globalSetup already boots, and a disposable Mongo replica set
// started here. Neither is a production system and neither survives the run.
//
// It seeds Postgres with a row in every table the plan migrates — including
// the awkward ones (a polymorphic like, a story like, a soft-deleted story, a
// null-FK consent, an admin notification with no receiver) — runs the real
// migration and the real validator, and asserts on what arrived.
//
// The point is not that the code runs. It is that VALIDATION PASSES: counts,
// derived ids, relationship resolution, field fidelity and the two derived
// arrays all agree with Postgres.
import { PrismaClient } from "@prisma/client";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mongoose, models } from "../../../shared/database/mongodb/index.js";
import { migrateAll } from "../../scripts/migrate-to-mongo/engine.js";
import { DERIVATIONS } from "../../scripts/migrate-to-mongo/derive.js";
import { validateAll } from "../../scripts/migrate-to-mongo/validate.js";
import { syncIndexes, findUndeclaredIndexes } from "../../scripts/migrate-to-mongo/indexes.js";
import { preflight } from "../../scripts/migrate-to-mongo/preflight.js";
import { PLAN } from "../../scripts/migrate-to-mongo/plan.js";
import { oid } from "../../scripts/migrate-to-mongo/ids.js";

const prisma = new PrismaClient();
let replSet;
const silent = () => {};
const lines = [];
const capture = (...a) => lines.push(a.join(" "));

// Seeded ids, kept so assertions can address exact rows.
const S = {};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "cutover_rehearsal" });
  await seedPostgres();
}, 180000);

afterAll(async () => {
  await prisma.$disconnect();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (replSet) await replSet.stop();
}, 60000);

const uniq = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

async function seedPostgres() {
  const u = uniq();

  S.author = await prisma.user.create({
    data: {
      username: `mig_a_${u}`, email: `mig-a-${u}@e.com`, fullName: "Author One",
      password: "$2b$10$notarealhashbutlooksright000000000000000000000000000",
      role: "user", accountStatus: "active",
      followersCount: 3, followingCount: 5, postsCount: 2,
      avatar: { url: "https://cdn.example/a.jpg", publicId: "a", type: "image" },
      location: { city: "Kishangarh", state: "Rajasthan" },
      bio: "marble", designation: "Owner", businessCategory: "marble",
      activeSuspension: { reason: "spam", expiresAt: new Date(Date.now() + 864e5).toISOString() },
      lastActiveAt: new Date(),
    },
  });
  S.viewer = await prisma.user.create({
    data: {
      username: `mig_v_${u}`, email: `mig-v-${u}@e.com`, fullName: "Viewer Two",
      password: "$2b$10$notarealhashbutlooksright000000000000000000000000000",
      role: "super_admin", accountStatus: "active",
    },
  });

  S.session = await prisma.refreshToken.create({
    data: {
      userId: S.author.id, tokenHash: `hash_${u}`, deviceInfo: "chrome",
      ipAddress: "1.2.3.4", expiresAt: new Date(Date.now() + 864e5), lastUsedAt: new Date(),
    },
  });

  S.suspension = await prisma.suspensionHistory.create({
    data: { userId: S.author.id, action: "suspend", reason: "spam", duration: 7, performedBy: S.viewer.id },
  });

  S.post = await prisma.post.create({
    data: {
      authorId: S.author.id, type: "image", caption: "Statuario slab",
      hashtags: ["marble", "statuario"], mentions: [],
      media: [{ url: "https://cdn.example/1.jpg", publicId: "1", type: "image" },
              { url: "https://cdn.example/2.jpg", publicId: "2", type: "image" }],
      location: { name: "Kishangarh", coordinates: { type: "Point", coordinates: [74.86, 26.57] } },
      likesCount: 1, commentsCount: 1, viewsCount: 9, visibility: "public",
    },
  });
  S.deletedPost = await prisma.post.create({
    data: { authorId: S.author.id, type: "image", caption: "gone", isDeleted: true, deletedAt: new Date() },
  });

  S.comment = await prisma.comment.create({
    data: { postId: S.post.id, authorId: S.viewer.id, content: "How thick?", depth: 0, status: "active" },
  });
  S.reply = await prisma.comment.create({
    data: {
      postId: S.post.id, authorId: S.author.id, content: "20mm", depth: 1,
      parentCommentId: S.comment.id, rootCommentId: S.comment.id,
    },
  });

  S.story = await prisma.story.create({
    data: {
      authorId: S.author.id, type: "media", audience: "public",
      expiresAt: new Date(Date.now() + 864e5), viewsCount: 2,
      media: { url: "https://cdn.example/s.jpg", publicId: "s", type: "image" },
      closeFriends: [S.viewer.id],
    },
  });
  S.deletedStory = await prisma.story.create({
    data: {
      authorId: S.author.id, type: "text", audience: "followers",
      expiresAt: new Date(Date.now() + 864e5), isDeleted: true, deletedAt: new Date(),
    },
  });

  // Three like shapes: post, comment, story — the polymorphic collapse.
  S.likePost = await prisma.like.create({
    data: { likedById: S.viewer.id, targetModel: "Post", postId: S.post.id, reaction: "❤️" },
  });
  S.likeComment = await prisma.like.create({
    data: { likedById: S.author.id, targetModel: "Comment", commentId: S.comment.id, reaction: "👍" },
  });
  S.likeStory = await prisma.like.create({
    data: { likedById: S.viewer.id, targetModel: "Story", storyId: S.story.id, reaction: "🔥" },
  });

  S.follow = await prisma.follow.create({
    data: { followerId: S.viewer.id, followingId: S.author.id, status: "accepted" },
  });
  S.saved = await prisma.saved.create({ data: { savedById: S.viewer.id, postId: S.post.id } });
  S.block = await prisma.block.create({ data: { blockerId: S.author.id, blockedId: S.viewer.id } });
  S.storyView = await prisma.storyView.create({
    data: { storyId: S.story.id, viewerId: S.viewer.id, reaction: "🔥", reactedAt: new Date() },
  });
  S.postView = await prisma.postView.create({
    data: { postId: S.post.id, userId: S.viewer.id, duration: 12, source: "explore" },
  });
  S.anonView = await prisma.postView.create({
    data: { postId: S.post.id, sessionId: "anon-1", duration: 3 }, // null userId
  });

  S.highlight = await prisma.highlight.create({
    data: {
      authorId: S.author.id, title: "Slabs", coverImage: "https://cdn.example/c.jpg",
      snapshots: [{ id: "snap-1", storyId: S.story.id, type: "media" }],
    },
  });
  S.highlightStory = await prisma.highlightStory.create({
    data: { highlightId: S.highlight.id, storyId: S.story.id },
  });

  S.conversation = await prisma.conversation.create({
    data: {
      isGroup: false, isActive: true, participantsKey: `pk_${u}`,
      lastMessage: { text: "hi", senderId: S.author.id, sentAt: new Date().toISOString() },
    },
  });
  S.p1 = await prisma.conversationParticipant.create({
    data: { conversationId: S.conversation.id, userId: S.author.id, unreadCount: 0 },
  });
  S.p2 = await prisma.conversationParticipant.create({
    data: { conversationId: S.conversation.id, userId: S.viewer.id, unreadCount: 4 },
  });
  S.message = await prisma.message.create({
    data: {
      conversationId: S.conversation.id, senderId: S.author.id, text: "cipher:abc", type: "text",
      reactions: [{ emoji: "👍", userId: S.viewer.id }],
    },
  });
  S.receipt = await prisma.messageReceipt.create({
    data: {
      messageId: S.message.id, conversationId: S.conversation.id,
      userId: S.viewer.id, seenAt: new Date(),
    },
  });

  S.notification = await prisma.notification.create({
    data: {
      receiverId: S.author.id, senderId: S.viewer.id, type: "post_like",
      refModel: "Post", refId: S.post.id, meta: { postId: S.post.id },
    },
  });
  S.adminNotification = await prisma.adminNotification.create({
    data: { type: "admin_new_user", label: "New user registered", meta: { userId: S.author.id } },
  });

  S.report = await prisma.report.create({
    data: {
      reportedById: S.viewer.id, targetModel: "Post", targetId: S.post.id, postId: S.post.id,
      reason: "spam", description: "spammy", status: "pending", priority: "low",
      moderatorNote: "watch this one",
    },
  });
  S.userReport = await prisma.report.create({
    data: {
      reportedById: S.author.id, targetModel: "User", targetId: S.viewer.id,
      reportedUserId: S.viewer.id, reason: "abuse", status: "pending", priority: "high",
    },
  });

  S.audit = await prisma.auditLog.create({
    data: {
      performedById: S.viewer.id, performedByName: "Viewer Two", action: "post.delete",
      category: "social", targetType: "Post", targetId: S.post.id, ipAddress: "1.2.3.4",
    },
  });
  S.consent = await prisma.consent.create({
    data: { userId: S.author.id, sessionId: `sess_${u}`, essential: true, analytics: true, marketing: false, policyVersion: "v1" },
  });
  S.guestConsent = await prisma.consent.create({
    data: { sessionId: `guest_${u}`, essential: true, analytics: false, marketing: false, policyVersion: "v1" },
  });
  S.otp = await prisma.oTP.create({
    data: {
      userId: S.author.id, purpose: "email_verify", hashedOtp: "hashed",
      expiresAt: new Date(Date.now() + 6e5),
    },
  });
  S.hashtag = await prisma.hashtag.create({
    data: { name: `marble_${u}`, postsCount: 1, trendingScore: 1.5, lastUsedAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────────────────
describe("Phase 8 — migration dry run", () => {
  test("dry run writes nothing to Mongo and reports every source row", async () => {
    await syncIndexes({ log: silent, dryRun: true });
    const results = await migrateAll(prisma, { dryRun: true, log: silent });

    // Every planned collection was visited and saw its source rows.
    expect(Object.keys(results).length).toBeGreaterThanOrEqual(20);
    expect(results.user.source).toBeGreaterThanOrEqual(2);
    expect(results.like.source).toBeGreaterThanOrEqual(3);

    // Nothing failed to map, nothing collided.
    for (const [name, r] of Object.entries(results)) {
      expect(`${name}:failed=${r.failed}`).toBe(`${name}:failed=0`);
      expect(`${name}:duplicates=${r.duplicates}`).toBe(`${name}:duplicates=0`);
    }

    // …and the destination is still empty.
    expect(await models.User.countDocuments({})).toBe(0);
    expect(await models.SocialPost.countDocuments({})).toBe(0);
  }, 120000);
});

describe("Phase 8 — real migration", () => {
  beforeAll(async () => {
    await syncIndexes({ log: silent, dryRun: false });
    await migrateAll(prisma, { dryRun: false, log: silent });
    for (const d of DERIVATIONS) await d.run(prisma, { dryRun: false, log: silent });
  }, 120000);

  test("validation passes: counts, ids, relationships, fields, derived arrays", async () => {
    lines.length = 0;
    const { failures } = await validateAll(prisma, { log: capture });
    if (failures.length) {
      // Surface the validator's own output — it names the exact collection.
      throw new Error(`Validation reported ${failures.length} failure(s):\n  ` + failures.join("\n  "));
    }
    expect(failures).toEqual([]);
  }, 120000);

  test("is idempotent — a second run inserts nothing new", async () => {
    const before = await models.SocialPost.countDocuments({});
    const results = await migrateAll(prisma, { dryRun: false, log: silent });
    expect(await models.SocialPost.countDocuments({})).toBe(before);
    for (const [name, r] of Object.entries(results)) {
      expect(`${name}:inserted=${r.inserted}`).toBe(`${name}:inserted=0`);
    }
  }, 120000);

  test("user: rename, Json→subdocument, counters and role survive", async () => {
    const u = await models.User.findById(oid(S.author.id)).select("+passwordHash").lean();
    expect(u.passwordHash).toBe(S.author.password);   // renamed from `password`
    expect(u.fullName).toBe("Author One");            // was on `profiles` pre-Phase-7
    expect(u.role).toBe("user");                      // string, not { roleKey }
    expect(u.followersCount).toBe(3);                 // copied, not recomputed
    expect(u.postsCount).toBe(2);
    expect(u.avatar.url).toBe("https://cdn.example/a.jpg");
    expect(u.location.city).toBe("Kishangarh");
    expect(u.activeSuspension.reason).toBe("spam");   // Json → typed subdoc
    expect(u.createdAt.getTime()).toBe(S.author.createdAt.getTime()); // exact
  });

  test("super_admin role maps across unchanged", async () => {
    expect((await models.User.findById(oid(S.viewer.id)).lean()).role).toBe("super_admin");
  });

  test("post: media order, location blob and soft-delete state", async () => {
    const p = await models.SocialPost.findById(oid(S.post.id)).lean();
    expect(p.media.map((m) => m.publicId)).toEqual(["1", "2"]); // ORDER preserved
    expect(p.location.name).toBe("Kishangarh");
    expect(p.isDeleted).toBe(false);
    expect(p.likesCount).toBe(1);
    expect(String(p.authorId)).toBe(String(oid(S.author.id)));

    const gone = await models.SocialPost.findById(oid(S.deletedPost.id)).lean();
    expect(gone.isDeleted).toBe(true);
    expect(gone.deletedAt).toBeTruthy();
  });

  test("likes: three FK shapes collapse to targetType + targetId", async () => {
    const post = await models.Like.findById(oid(S.likePost.id)).lean();
    expect(post.targetType).toBe("post");
    expect(String(post.targetId)).toBe(String(oid(S.post.id)));

    const comment = await models.Like.findById(oid(S.likeComment.id)).lean();
    expect(comment.targetType).toBe("comment");
    expect(String(comment.targetId)).toBe(String(oid(S.comment.id)));

    const story = await models.Like.findById(oid(S.likeStory.id)).lean();
    expect(story.targetType).toBe("story");
    expect(String(story.targetId)).toBe(String(oid(S.story.id)));
  });

  test("story soft-delete comes from PostgreSQL, not inferred from expiry", async () => {
    const live = await models.Story.findById(oid(S.story.id)).lean();
    expect(live.isDeleted).toBe(false);
    expect(live.expiresAt.getTime()).toBe(S.story.expiresAt.getTime());
    expect(live.closeFriends.map(String)).toEqual([String(oid(S.viewer.id))]);

    const gone = await models.Story.findById(oid(S.deletedStory.id)).lean();
    expect(gone.isDeleted).toBe(true);
    expect(gone.deletedAt).toBeTruthy();
  });

  test("report: targetModel → targetType, explicit FKs kept, moderatorNote preserved", async () => {
    const r = await models.Report.findById(oid(S.report.id)).lean();
    expect(r.targetType).toBe("post");                       // 'Post' → 'post'
    expect(String(r.targetId)).toBe(String(oid(S.post.id))); // uuid → ObjectId
    expect(String(r.postId)).toBe(String(oid(S.post.id)));   // FK the admin UI populates
    expect(r.moderatorNote).toBe("watch this one");

    const ur = await models.Report.findById(oid(S.userReport.id)).lean();
    expect(ur.targetType).toBe("user");
    expect(String(ur.reportedUserId)).toBe(String(oid(S.viewer.id)));
  });

  test("report relations populate by their Prisma names", async () => {
    // This is what StrictPopulateError used to make impossible.
    const r = await models.Report.findById(oid(S.report.id))
      .populate("reportedBy")
      .populate("post");
    expect(r.reportedBy.username).toBe(S.viewer.username);
    expect(r.post.caption).toBe("Statuario slab");
  });

  test("notifications: two tables, one collection, disjoint audiences", async () => {
    const n = await models.Notification.findById(oid(S.notification.id)).lean();
    expect(n.audience).toBe("user");
    expect(n.refType).toBe("Post");                            // refModel → refType
    expect(String(n.refId)).toBe(String(oid(S.post.id)));
    expect(String(n.receiverId)).toBe(String(oid(S.author.id)));

    const a = await models.Notification.findById(oid(S.adminNotification.id)).lean();
    expect(a.audience).toBe("admin");
    expect(a.label).toBe("New user registered");               // column with no home before
    expect(a.receiverId).toBeFalsy();                          // broadcast
  });

  test("conversation: lastMessage subdocument and DERIVED participantIds", async () => {
    const c = await models.Conversation.findById(oid(S.conversation.id)).lean();
    expect(c.lastMessage.text).toBe("hi");
    expect(String(c.lastMessage.senderId)).toBe(String(oid(S.author.id)));
    // participantIds has no Postgres column — rebuilt from the join table.
    // findByParticipant() queries it, so an empty array hides every thread.
    expect(c.participantIds.map(String).sort()).toEqual(
      [String(oid(S.author.id)), String(oid(S.viewer.id))].sort()
    );
  });

  test("message: embedded reaction userIds are remapped", async () => {
    const m = await models.Message.findById(oid(S.message.id)).lean();
    expect(String(m.reactions[0].userId)).toBe(String(oid(S.viewer.id)));
    expect(m.text).toBe("cipher:abc"); // ciphertext carried, never re-encrypted
  });

  test("participant unread counters are copied, not reset", async () => {
    expect((await models.ConversationParticipant.findById(oid(S.p2.id)).lean()).unreadCount).toBe(4);
    expect((await models.ConversationParticipant.findById(oid(S.p1.id)).lean()).unreadCount).toBe(0);
  });

  test("highlight: snapshots kept in order, storyRefs derived from the join table", async () => {
    const h = await models.Highlight.findById(oid(S.highlight.id)).lean();
    expect(h.snapshots).toHaveLength(1);
    expect(h.snapshots[0].storyId).toBe(String(oid(S.story.id))); // remapped
    expect(h.storyRefs).toHaveLength(1);
    expect(String(h.storyRefs[0].storyId)).toBe(String(oid(S.story.id)));
  });

  test("session tokenHash survives, so live refresh tokens keep working", async () => {
    const s = await models.Session.findById(oid(S.session.id)).lean();
    expect(s.tokenHash).toBe(S.session.tokenHash);
    expect(s.expiresAt.getTime()).toBe(S.session.expiresAt.getTime());
  });

  test("nullable FKs stay absent rather than becoming defaults", async () => {
    const anon = await models.PostView.findById(oid(S.anonView.id)).lean();
    expect(anon.userId).toBeFalsy();          // anonymous view, no user invented
    expect(anon.sessionId).toBe("anon-1");

    const guest = await models.Consent.findById(oid(S.guestConsent.id)).lean();
    expect(guest.userId).toBeFalsy();
  });

  test("audit log: polymorphic targetId remapped, performedBy resolves", async () => {
    const a = await models.AuditLog.findById(oid(S.audit.id)).lean();
    expect(String(a.targetId)).toBe(String(oid(S.post.id)));
    expect(String(a.performedById)).toBe(String(oid(S.viewer.id)));
    expect(a.performedByName).toBe("Viewer Two");
  });

  test("no orphaned references anywhere in the migrated graph", async () => {
    lines.length = 0;
    const { relStats } = await validateAll(prisma, { log: capture });
    const orphaned = Object.entries(relStats).filter(([, s]) => s.orphans > 0);
    expect(orphaned).toEqual([]);
  }, 120000);
});

// ─────────────────────────────────────────────────────────────────────────
describe("Phase 8 Part 2 — preflight classifies real data hazards", () => {
  test("clean data produces no BLOCKER findings", async () => {
    const { blockers, warnings } = await preflight(prisma, { log: silent });
    // The seed is deliberately valid, so anything here is a false positive in
    // the preflight itself — which would make it useless as a cutover gate.
    expect(blockers.map((b) => `${b.model}.${b.field}: ${b.problem}`)).toEqual([]);
    expect(Array.isArray(warnings)).toBe(true);
  }, 120000);

  test("an out-of-enum value is reported as a BLOCKER, with the row id", async () => {
    // Postgres has no CHECK constraint on `category`; Mongo declares an enum.
    // This is the exact class of legacy value production may hold.
    const bad = await prisma.auditLog.create({
      data: {
        performedById: S.viewer.id, performedByName: "Viewer Two",
        action: "legacy.action", category: "legacy_category_no_longer_used",
      },
    });
    try {
      const { blockers } = await preflight(prisma, { log: silent });
      const hit = blockers.find(
        (b) => b.model === "AuditLog" && b.field === "category"
      );
      expect(hit).toBeTruthy();
      expect(hit.problem).toMatch(/legacy_category_no_longer_used/);
      expect(hit.sampleRowIds).toContain(bad.id);
      expect(hit.recommendedAction).toBeTruthy();
    } finally {
      await prisma.auditLog.delete({ where: { id: bad.id } });
    }
  }, 120000);

  test("a dangling nullable FK is a WARNING, not a BLOCKER", async () => {
    // The row still migrates; the reference was already dangling in
    // PostgreSQL. Treating it as a blocker would stop a cutover over a
    // pre-existing condition the migration did not cause.
    const ghost = await prisma.user.create({
      data: {
        username: `ghost_${uniq()}`, email: `ghost-${uniq()}@e.com`,
        fullName: "Ghost", password: "x", role: "user",
      },
    });
    const tag = await prisma.hashtag.create({
      data: { name: `orphan_${uniq()}`, bannedById: ghost.id, isBanned: true },
    });
    await prisma.user.delete({ where: { id: ghost.id } }).catch(() => {});
    try {
      const { blockers, warnings } = await preflight(prisma, { log: silent });
      expect(blockers.filter((b) => b.model === "hashtag")).toEqual([]);
      const warn = warnings.find((w) => w.model === "hashtag" && w.field === "bannedById");
      if (warn) expect(warn.severity).toBe("WARNING");
    } finally {
      await prisma.hashtag.delete({ where: { id: tag.id } }).catch(() => {});
    }
  }, 120000);
});

// ─────────────────────────────────────────────────────────────────────────
describe("Phase 8 Part 6 — idempotency, by full state comparison", () => {
  /** Every document in every migrated collection, canonically ordered. */
  async function snapshot() {
    const state = {};
    for (const name of [...new Set(PLAN.map((e) => e.model))]) {
      const docs = await models[name].find({}).sort({ _id: 1 }).lean();
      state[name] = docs.map((d) => JSON.stringify(d, Object.keys(d).sort()));
    }
    return state;
  }

  test("a second full run leaves Mongo byte-identical", async () => {
    // Stronger than "no new inserts": this compares every field of every
    // document. It is what catches a re-run that quietly resets a timestamp,
    // empties a derived array, or reorders an array the app depends on.
    await migrateAll(prisma, { dryRun: false, log: silent });
    for (const d of DERIVATIONS) await d.run(prisma, { dryRun: false, log: silent });
    const before = await snapshot();

    await migrateAll(prisma, { dryRun: false, log: silent });
    for (const d of DERIVATIONS) await d.run(prisma, { dryRun: false, log: silent });
    const after = await snapshot();

    for (const model of Object.keys(before)) {
      expect(`${model}:${after[model].length}`).toBe(`${model}:${before[model].length}`);
      expect({ model, docs: after[model] }).toEqual({ model, docs: before[model] });
    }
  }, 180000);

  test("a run WITHOUT the derive pass still leaves derived arrays intact", async () => {
    // The regression that made this necessary: the engine used replaceOne,
    // so re-running the data pass alone sent documents back without
    // participantIds/storyRefs and emptied both. Every conversation lost its
    // member list, and findByParticipant() then returns nothing for anyone.
    const conv = () => models.Conversation.findById(oid(S.conversation.id)).lean();
    const hl = () => models.Highlight.findById(oid(S.highlight.id)).lean();
    expect((await conv()).participantIds).toHaveLength(2);
    expect((await hl()).storyRefs).toHaveLength(1);

    await migrateAll(prisma, { dryRun: false, log: silent }); // data pass ONLY

    expect((await conv()).participantIds).toHaveLength(2);
    expect((await hl()).storyRefs).toHaveLength(1);
  }, 120000);

  test("validation still passes after the re-runs", async () => {
    const { failures } = await validateAll(prisma, { log: silent });
    expect(failures).toEqual([]);
  }, 120000);
});

// ─────────────────────────────────────────────────────────────────────────
describe("Phase 8 Part 7 — indexes", () => {
  test("every declared index exists, and nothing undeclared survives", async () => {
    await syncIndexes({ log: silent, dryRun: false });
    const stray = await findUndeclaredIndexes();
    expect(stray).toEqual([]);
  }, 120000);

  test("nullable unique fields do not collide", async () => {
    // The bug this pins: the driver serialises `undefined` as null, and a
    // sparse unique index skips only ABSENT fields — so two users without a
    // phone number both wrote null and the second aborted the batch.
    const withoutPhone = await models.User.countDocuments({ phoneNumber: { $exists: false } });
    expect(withoutPhone).toBeGreaterThanOrEqual(2);
    // $type:"null" matches an EXPLICIT null only. A bare `{phoneNumber: null}`
    // also matches absent fields, which is exactly the distinction that makes
    // a sparse unique index work — so the bare form cannot test this.
    const explicitNulls = await models.User.countDocuments({ phoneNumber: { $type: "null" } });
    expect(explicitNulls).toBe(0);
  }, 60000);

  test("unique indexes are actually enforced in the destination", async () => {
    const existing = await models.User.findById(oid(S.author.id)).lean();
    await expect(
      models.User.collection.insertOne({
        _id: oid("a-different-uuid-entirely"),
        username: existing.username, // duplicate
        email: `dup-${uniq()}@e.com`, fullName: "Dup", role: "user",
      })
    ).rejects.toThrow(/duplicate key/i);
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────
describe("FINAL AUDIT — the read-only modes are genuinely read-only", () => {
  /** A fingerprint of PostgreSQL: row counts plus the newest updatedAt. */
  async function pgFingerprint() {
    const fp = {};
    for (const entry of PLAN) {
      const count = await prisma[entry.source].count();
      let newest = null;
      try {
        const row = await prisma[entry.source].findFirst({
          orderBy: { updatedAt: "desc" }, select: { updatedAt: true },
        });
        newest = row?.updatedAt?.toISOString() ?? null;
      } catch {
        // table has no updatedAt (RefreshToken, MessageReceipt, …)
      }
      fp[entry.source] = { count, newest };
    }
    return fp;
  }

  /** A fingerprint of Mongo: document counts per migrated collection. */
  async function mongoFingerprint() {
    const fp = {};
    for (const name of [...new Set(PLAN.map((e) => e.model))]) {
      fp[name] = await models[name].countDocuments({});
    }
    return fp;
  }

  test("--preflight mutates NEITHER database", async () => {
    // Preflight runs against production before a maintenance window, so
    // "it only reads" has to be demonstrated, not asserted in a comment.
    const pgBefore = await pgFingerprint();
    const mongoBefore = await mongoFingerprint();

    await preflight(prisma, { log: silent, verbose: true });

    expect(await pgFingerprint()).toEqual(pgBefore);
    expect(await mongoFingerprint()).toEqual(mongoBefore);
  }, 120000);

  test("--validate-only mutates NEITHER database", async () => {
    const pgBefore = await pgFingerprint();
    const mongoBefore = await mongoFingerprint();

    await validateAll(prisma, { log: silent });

    expect(await pgFingerprint()).toEqual(pgBefore);
    expect(await mongoFingerprint()).toEqual(mongoBefore);
  }, 120000);

  test("--dry-run writes nothing to Mongo and nothing to PostgreSQL", async () => {
    const pgBefore = await pgFingerprint();
    const mongoBefore = await mongoFingerprint();

    await migrateAll(prisma, { dryRun: true, log: silent });
    for (const d of DERIVATIONS) await d.run(prisma, { dryRun: true, log: silent });

    expect(await pgFingerprint()).toEqual(pgBefore);
    expect(await mongoFingerprint()).toEqual(mongoBefore);
  }, 120000);

  test("a FAILING migration still leaves PostgreSQL untouched", async () => {
    // The property that makes rollback safe: whatever goes wrong on the Mongo
    // side, the source is unchanged, so reverting is a config switch rather
    // than a restore. Forced here by pointing a plan entry at a model whose
    // writes will throw.
    const pgBefore = await pgFingerprint();
    const broken = {
      source: "user",
      model: "User",
      map: () => { throw new Error("deliberate mapper failure"); },
    };
    const { migrateEntry } = await import("../../scripts/migrate-to-mongo/engine.js");
    const stats = await migrateEntry(broken, prisma, { dryRun: false, log: silent });

    expect(stats.failed).toBeGreaterThan(0);   // it really did fail
    expect(stats.inserted).toBe(0);
    expect(await pgFingerprint()).toEqual(pgBefore); // …and PostgreSQL is intact
  }, 120000);

  test("the engine issues no write operation against Prisma", async () => {
    // Belt and braces on the fingerprint check: proxy the client and record
    // any call to a mutating delegate method during a full run.
    const forbidden = ["create", "createMany", "update", "updateMany", "upsert",
                       "delete", "deleteMany", "executeRaw", "executeRawUnsafe"];
    const calls = [];
    const guard = new Proxy(prisma, {
      get(target, table) {
        const delegate = target[table];
        if (!delegate || typeof delegate !== "object") return delegate;
        return new Proxy(delegate, {
          get(d, method) {
            if (forbidden.includes(String(method))) {
              calls.push(`${String(table)}.${String(method)}`);
            }
            return d[method];
          },
        });
      },
    });

    await migrateAll(guard, { dryRun: false, log: silent });
    for (const d of DERIVATIONS) await d.run(guard, { dryRun: false, log: silent });
    await validateAll(guard, { log: silent });
    await preflight(guard, { log: silent });

    expect(calls).toEqual([]);
  }, 180000);
});
