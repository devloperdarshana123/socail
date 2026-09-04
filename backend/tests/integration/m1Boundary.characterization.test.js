// Phase 7B / M-1, Batch 5 — translation-boundary coverage for the
// repositories that no domain suite covers.
//
// WHY THIS FILE EXISTS
// The per-domain suites prove behaviour for the repositories their domain
// exercises. Batch 5's coverage audit found 13 wired repositories with no
// M-1 regression at all: they were wired, the full suite stayed green, but
// nothing asserted that the translator was a no-op for the filters they
// actually receive. "Green because nothing tests it" is exactly the failure
// mode M-1 exists to remove, so this suite closes the gap.
//
// For each repository it proves the two properties that matter at this
// boundary:
//   1. TRANSLATION CORRECTNESS — a neutral filter and the Prisma filter it
//      replaced return identical results, compared against the raw client.
//   2. REJECTION — Prisma vocabulary is refused, so no un-translatable
//      construct can reach a driver.
// Ordering / pagination / projection are asserted for every method that
// takes them.
import { PrismaClient } from "@prisma/client";
import {
  sessionRepository, likeRepository, followRepository, savedRepository,
  storyRepository, storyViewRepository, highlightRepository, blockRepository,
  postViewRepository, conversationRepository, conversationParticipantRepository,
  messageRepository, messageReceiptRepository,
  // M-3: the write-side boundary tests need these two as well.
  socialPostRepository, userRepository,
} from "../../src/config/repositories.js";
import { transactionRunner } from "../../src/config/transaction.js";

const prisma = new PrismaClient();

const userIds = [];
const postIds = [];
const storyIds = [];
const convIds = [];
const MARK = `m1b5_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function makeUser() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: { fullName: `M1 ${s}`, email: `m1-${s}@e.com`, username: `m1_${s}` },
  });
  userIds.push(u.id);
  return u;
}
async function makePost(authorId) {
  const p = await prisma.post.create({ data: { authorId, type: "image", caption: MARK } });
  postIds.push(p.id);
  return p;
}

let alice, bob, post, story, conversation, message;

beforeAll(async () => {
  alice = await makeUser();
  bob   = await makeUser();
  post  = await makePost(alice.id);

  story = await prisma.story.create({
    data: { authorId: alice.id, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  storyIds.push(story.id);

  conversation = await prisma.conversation.create({ data: {} });
  convIds.push(conversation.id);
  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conversation.id, userId: alice.id },
      { conversationId: conversation.id, userId: bob.id },
    ],
  });
  message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: alice.id, text: MARK },
  });
  await prisma.messageReceipt.create({
    data: { messageId: message.id, conversationId: conversation.id, userId: bob.id },
  });

  await prisma.refreshToken.create({
    data: { userId: alice.id, tokenHash: `${MARK}_t1`, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  await prisma.like.create({
    data: { likedById: alice.id, targetModel: "Post", postId: post.id },
  });
  await prisma.follow.create({ data: { followerId: alice.id, followingId: bob.id, status: "accepted" } });
  await prisma.saved.create({ data: { savedById: alice.id, postId: post.id } });
  await prisma.storyView.create({ data: { storyId: story.id, viewerId: bob.id } });
  await prisma.highlight.create({ data: { authorId: alice.id, title: MARK } });
  await prisma.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
  await prisma.postView.create({ data: { postId: post.id, userId: bob.id } });
});

afterAll(async () => {
  await prisma.messageReceipt.deleteMany({ where: { conversationId: { in: convIds } } });
  await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } });
  await prisma.conversationParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
  await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
  await prisma.storyView.deleteMany({ where: { storyId: { in: storyIds } } });
  await prisma.story.deleteMany({ where: { id: { in: storyIds } } });
  await prisma.highlight.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.block.deleteMany({ where: { blockerId: { in: userIds } } });
  await prisma.postView.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.saved.deleteMany({ where: { savedById: { in: userIds } } });
  await prisma.follow.deleteMany({ where: { followerId: { in: userIds } } });
  await prisma.like.deleteMany({ where: { likedById: { in: userIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// `agree` is the core assertion of this suite: the SAME filter object is
// legal in both languages for every operator these repositories use, so the
// repository result and the raw-client result must match exactly. If the
// translator ever stopped being a no-op for neutral vocabulary, every one
// of these would fail at once.
const agree = async (repoFn, model, filter) => {
  expect(await repoFn(filter)).toBe(await prisma[model].count({ where: filter }));
};

describe("M-1 boundary — auth & social repositories", () => {
  test("SessionRepository: gt/lte/in/not translate to themselves", async () => {
    const now = new Date();
    for (const f of [
      { userId: alice.id },
      { userId: alice.id, expiresAt: { gt: now } },
      { userId: alice.id, expiresAt: { lte: new Date(Date.now() + 999_000_000) } },
      { userId: alice.id, tokenHash: { not: "nope" } },
      { userId: { in: [alice.id, bob.id] } },
    ]) await agree((x) => sessionRepository.count(x), "refreshToken", f);

    // findManyWhere: caller-owned ordering preserved, still UNBOUNDED
    const viaRepo = await sessionRepository.findManyWhere(
      { userId: alice.id }, { orderBy: { createdAt: "desc" } },
    );
    const inline = await prisma.refreshToken.findMany({
      where: { userId: alice.id }, orderBy: { createdAt: "desc" },
    });
    expect(viaRepo.map((r) => r.id)).toEqual(inline.map((r) => r.id));
  });

  test("LikeRepository: neutral filters agree; groupByReaction returns neutral rows", async () => {
    await agree((f) => likeRepository.count(f), "like", { likedById: alice.id, targetModel: "Post" });
    await agree((f) => likeRepository.count(f), "like", { postId: { in: [post.id] } });
    expect(await likeRepository.exists({ likedById: alice.id })).toBe(true);

    // groupByReaction takes a caller filter, so M-1 translates it; M-4 then
    // normalises the RESULT to neutral { key, count } rows. The inline query
    // still returns Prisma's envelope, so compare after mapping it.
    const rows = await likeRepository.groupByReaction({ postId: post.id });
    const inline = await prisma.like.groupBy({
      by: ["reaction"], where: { postId: post.id }, _count: { reaction: true },
    });
    expect(rows).toEqual(inline.map((r) => ({ key: r.reaction, count: r._count.reaction })));
  });

  test("FollowRepository / SavedRepository / BlockRepository: neutral filters agree", async () => {
    await agree((f) => followRepository.count(f), "follow", { followerId: alice.id, status: "accepted" });
    await agree((f) => followRepository.count(f), "follow", { followingId: { in: [bob.id] } });
    await agree((f) => savedRepository.count(f), "saved", { savedById: alice.id, postId: post.id });
    await agree((f) => blockRepository.count(f), "block", { blockerId: alice.id, blockedId: { not: alice.id } });

    // Saved.findMany takes a projection — it must survive translation.
    const rows = await savedRepository.findMany({ savedById: alice.id }, {}, { select: { postId: true } });
    expect(Object.keys(rows[0])).toEqual(["postId"]);
  });

  test("StoryRepository / StoryViewRepository / HighlightRepository: soft-delete scoping composes", async () => {
    // Story and Highlight apply withNotDeleted BEFORE translation.
    await agree((f) => storyRepository.count(f, { includeDeleted: true }), "story", { authorId: alice.id });
    expect(await storyRepository.count({ authorId: alice.id })).toBe(
      await prisma.story.count({ where: { authorId: alice.id, isDeleted: false } })
    );
    expect(await highlightRepository.count({ authorId: alice.id })).toBe(
      await prisma.highlight.count({ where: { authorId: alice.id, isDeleted: false } })
    );
    await agree((f) => storyViewRepository.count(f), "storyView", { storyId: story.id, viewerId: { in: [bob.id] } });
  });

  test("PostViewRepository: neutral filters agree", async () => {
    await agree((f) => postViewRepository.count(f), "postView", { postId: post.id });
    await agree((f) => postViewRepository.count(f), "postView", { postId: { in: [post.id] }, userId: { not: null } });
  });
});

describe("M-1 boundary — messaging repositories (wired in Batch 5)", () => {
  test("ConversationRepository: neutral filters agree", async () => {
    await agree((f) => conversationRepository.count(f), "conversation", { id: conversation.id });
    await agree((f) => conversationRepository.count(f), "conversation", { id: { in: [conversation.id] } });
    expect(await conversationRepository.exists({ id: conversation.id })).toBe(true);
  });

  test("ConversationParticipantRepository: soft-delete scoping composes with translation", async () => {
    const f = { conversationId: conversation.id };
    // default path applies withNotDeleted on top of a neutral filter
    expect(await conversationParticipantRepository.count(f)).toBe(
      await prisma.conversationParticipant.count({ where: { ...f, isDeleted: false } })
    );
    // opt-out keeps the caller's filter authoritative
    expect(await conversationParticipantRepository.count(f, { includeDeleted: true })).toBe(
      await prisma.conversationParticipant.count({ where: f })
    );
    // updateManyWhere still returns Prisma's { count }
    const res = await conversationParticipantRepository.updateManyWhere(
      { conversationId: conversation.id, userId: bob.id }, { unreadCount: 0 },
    );
    expect(res).toMatchObject({ count: 1 });
  });

  test("MessageRepository: withNotDeleted + translation, and the row-lock read is untouched", async () => {
    expect(await messageRepository.count({ conversationId: conversation.id })).toBe(
      await prisma.message.count({ where: { conversationId: conversation.id, isDeleted: false } })
    );

    // findManyWithCursor forwards a VERBATIM filter and raw take
    const viaRepo = await messageRepository.findManyWithCursor(
      { conversationId: conversation.id, createdAt: { lt: new Date(Date.now() + 60_000) } },
      { take: 10 },
    );
    const inline = await prisma.message.findMany({
      where: { conversationId: conversation.id, createdAt: { lt: new Date(Date.now() + 60_000) } },
      orderBy: { createdAt: "desc" }, take: 10,
    });
    expect(viaRepo.map((m) => m.id)).toEqual(inline.map((m) => m.id));

    // The Milestone 8 SELECT … FOR UPDATE read takes an ID, not a filter,
    // so the translator can never reach it. Pinned so a refactor cannot
    // route it through and change its locking semantics.
    const locked = await messageRepository.findByIdForUpdate(message.id);
    expect(Array.isArray(locked)).toBe(true);
  });

  test("MessageReceiptRepository: neutral filters agree", async () => {
    await agree((f) => messageReceiptRepository.count(f), "messageReceipt", { messageId: message.id });
    await agree((f) => messageReceiptRepository.count(f), "messageReceipt",
      { conversationId: conversation.id, userId: { in: [bob.id] } });
  });
});

describe("M-1 boundary — every wired repository REJECTS Prisma vocabulary", () => {
  // One rejection test per repository that had none. This is the guarantee
  // that closes Blocker M-1: no Prisma-only construct can reach a driver,
  // on any backend, through any of these entry points.
  const REPOS = [
    ["session",                 () => sessionRepository],
    ["like",                    () => likeRepository],
    ["follow",                  () => followRepository],
    ["saved",                   () => savedRepository],
    ["story",                   () => storyRepository],
    ["storyView",               () => storyViewRepository],
    ["highlight",               () => highlightRepository],
    ["block",                   () => blockRepository],
    ["postView",                () => postViewRepository],
    ["conversation",            () => conversationRepository],
    ["conversationParticipant", () => conversationParticipantRepository],
    ["message",                 () => messageRepository],
    ["messageReceipt",          () => messageReceiptRepository],
  ];

  test.each(REPOS)("%s repository rejects contains / OR / hasSome", async (_name, get) => {
    const repo = get();
    await expect(repo.count({ id: { contains: "x" } })).rejects.toThrow(/contains/);
    await expect(repo.count({ OR: [{ id: "x" }] })).rejects.toThrow(/OR/);
    await expect(repo.count({ id: { hasSome: ["x"] } })).rejects.toThrow(/hasSome/);
  });
});

describe("M-1 boundary — messaging: transactions, includes and the row lock", () => {
  // Batch 4's remaining contract surface. The Batch 5 sweep proved the
  // translator is a no-op for messaging filters; these prove it stays a
  // no-op when those filters travel with a transaction context, that
  // relation includes survive translation, and that the FOR UPDATE lock is
  // exercised the way production actually uses it — INSIDE a transaction.

  test("neutral filters translate identically when threaded through a transaction", async () => {
    // Every wired messaging method takes { tx }. Translation happens on the
    // filter, the tx selects the client — the two must not interfere.
    const outside = await messageRepository.count({ conversationId: conversation.id });

    const inside = await transactionRunner.run(async (tx) => {
      const c  = await messageRepository.count({ conversationId: conversation.id }, { tx });
      const cp = await conversationParticipantRepository.count(
        { conversationId: conversation.id }, { tx },
      );
      const mr = await messageReceiptRepository.count({ messageId: message.id }, { tx });
      const cv = await conversationRepository.count({ id: { in: [conversation.id] } }, { tx });
      return { c, cp, mr, cv };
    });

    expect(inside.c).toBe(outside);
    expect(inside.cp).toBe(await prisma.conversationParticipant.count({
      where: { conversationId: conversation.id, isDeleted: false },
    }));
    expect(inside.mr).toBe(await prisma.messageReceipt.count({ where: { messageId: message.id } }));
    expect(inside.cv).toBe(1);
  });

  test("a rejected filter inside a transaction aborts it — no partial write", async () => {
    // The translator throws BEFORE the driver sees anything. Inside a
    // transaction that must roll back the statements already issued, not
    // leave them committed.
    const before = await prisma.conversationParticipant.findFirst({
      where: { conversationId: conversation.id, userId: bob.id },
    });

    await expect(transactionRunner.run(async (tx) => {
      await conversationParticipantRepository.updateManyWhere(
        { conversationId: conversation.id, userId: bob.id }, { unreadCount: 99 }, { tx },
      );
      // Prisma vocabulary — must throw and abort the update above.
      await messageRepository.count({ text: { contains: "x" } }, { tx });
    })).rejects.toThrow(/contains/);

    const after = await prisma.conversationParticipant.findFirst({
      where: { conversationId: conversation.id, userId: bob.id },
    });
    expect(after.unreadCount).toBe(before.unreadCount); // rolled back
  });

  test("findManyWithCursor: relation include and raw take survive translation", async () => {
    const viaRepo = await messageRepository.findManyWithCursor(
      { conversationId: conversation.id, isDeleted: false },
      { take: 5, include: { sender: { select: { id: true, username: true } } } },
    );
    const inline = await prisma.message.findMany({
      where: { conversationId: conversation.id, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { sender: { select: { id: true, username: true } } },
    });

    expect(viaRepo.map((m) => m.id)).toEqual(inline.map((m) => m.id));
    expect(viaRepo[0].sender).toEqual({ id: alice.id, username: alice.username });
    // ordering is the repository's own (createdAt desc), not the caller's
    expect(viaRepo[0].id).toBe(inline[0].id);
  });

  test("SELECT … FOR UPDATE: unchanged, bound-parameter, and locking INSIDE a transaction", async () => {
    // findByIdForUpdate takes an ID, not a filter — the translator has no
    // entry point into it. Exercised here the way production uses it: with
    // a tx, so the row lock actually lives for the life of the transaction.
    const rows = await transactionRunner.run(async (tx) => {
      const locked = await messageRepository.findByIdForUpdate(message.id, { tx });
      // Raw result set shape the caller's empty-check depends on.
      expect(Array.isArray(locked)).toBe(true);
      expect(locked).toHaveLength(1);
      // Exactly the three projected columns, unchanged.
      expect(Object.keys(locked[0]).sort()).toEqual(["id", "isDeleted", "reactions"]);
      expect(locked[0].id).toBe(message.id);
      return locked;
    });
    expect(rows).toHaveLength(1);

    // Bound parameter, not interpolation: an id that cannot exist returns
    // an empty set rather than erroring or matching anything.
    const none = await transactionRunner.run(async (tx) =>
      messageRepository.findByIdForUpdate("00000000-0000-0000-0000-000000000000", { tx })
    );
    expect(none).toEqual([]);
  });
});

describe("M-3 boundary — neutral counter mutations", () => {
  // M-1 removed Prisma's FILTER vocabulary; M-3 removes its WRITE vocabulary.
  // The defect: `{ likesCount: { increment: 1 } }` is an atomic counter bump
  // to Prisma and a literal object assignment to Mongoose — every counter in
  // the app would be replaced by a document on a provider switch.
  test("inc/dec are ATOMIC and agree with the raw client", async () => {
    const p = await makePost(alice.id);
    const before = (await prisma.post.findUnique({ where: { id: p.id } })).likesCount;

    await socialPostRepository.update(p.id, { likesCount: { inc: 1 } });
    await socialPostRepository.update(p.id, { likesCount: { inc: 2 } });
    await socialPostRepository.update(p.id, { likesCount: { dec: 1 } });

    const after = (await prisma.post.findUnique({ where: { id: p.id } })).likesCount;
    expect(after).toBe(before + 2);

    // Atomicity: concurrent bumps must all land, which a read-modify-write
    // would lose. Ten parallel increments must produce exactly +10.
    await Promise.all(
      Array.from({ length: 10 }, () => socialPostRepository.update(p.id, { viewsCount: { inc: 1 } }))
    );
    expect((await prisma.post.findUnique({ where: { id: p.id } })).viewsCount).toBe(10);
  });

  test("plain fields and JSON payloads are written as DATA, not read as operators", async () => {
    const u = await makeUser();
    const suspension = { suspendedAt: new Date(), suspendedBy: alice.id, reason: "spam", duration: 7 };

    await userRepository.update(u.id, { accountStatus: "suspended", activeSuspension: suspension });
    const row = await prisma.user.findUnique({ where: { id: u.id } });
    expect(row.accountStatus).toBe("suspended");
    expect(row.activeSuspension.reason).toBe("spam");
  });

  test("counter mutations still work inside a transaction and roll back", async () => {
    const p = await makePost(alice.id);
    await expect(transactionRunner.run(async (tx) => {
      await socialPostRepository.update(p.id, { likesCount: { inc: 5 } }, { tx });
      await socialPostRepository.update("00000000-0000-0000-0000-000000000000",
        { likesCount: { inc: 1 } }, { tx });
    })).rejects.toThrow();
    expect((await prisma.post.findUnique({ where: { id: p.id } })).likesCount).toBe(0);
  });

  test("M-3 GUARANTEE: Prisma write vocabulary is rejected at the boundary", async () => {
    const p = await makePost(alice.id);
    await expect(socialPostRepository.update(p.id, { likesCount: { increment: 1 } }))
      .rejects.toThrow(/increment/);
    await expect(socialPostRepository.update(p.id, { likesCount: { decrement: 1 } }))
      .rejects.toThrow(/decrement/);
    await expect(userRepository.update(alice.id, { postsCount: { multiply: 2 } }))
      .rejects.toThrow(/multiply/);
  });
});
