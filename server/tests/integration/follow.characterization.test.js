// Characterization test for the `follow` domain — the reference slice for
// the Milestone 5 helpers-as-boundary refactor.
//
// This locks down the OBSERVABLE behavior of the follow persistence layer
// (followHelpers.js) against a real Postgres BEFORE the refactor, so the
// same assertions can prove the behavior is byte-identical AFTER. It is
// deliberately written against the helper layer's public contract, not its
// internals, so it survives the refactor (and remains a regression net for
// Milestone 6, when followHelpers gets rewired onto the repositories).
//
// The follow state machine + denormalized follower/following counters are
// the actual business behavior here; those are what must not change.
import { PrismaClient } from "@prisma/client";
import * as FollowHelper from "../../src/utils/followHelpers.js";
import { followRepository } from "../../src/config/repositories.js";

const prisma = new PrismaClient();

// Fixture users — created fresh per test file, cleaned up in afterAll.
let publicUser; // isPrivate: false, accountStatus: active
let privateUser; // isPrivate: true, accountStatus: active
let actor; // the user doing the following

async function makeUser({ isPrivate = false, accountStatus = "active", suffix }) {
  return prisma.user.create({
    data: {
      fullName: `Follow Test ${suffix}`,
      email: `follow-char-${suffix}-${Date.now()}@example.com`,
      username: `followchar_${suffix}_${Date.now()}`,
      isPrivate,
      accountStatus,
    },
  });
}

beforeAll(async () => {
  actor = await makeUser({ suffix: "actor" });
  publicUser = await makeUser({ suffix: "public" });
  privateUser = await makeUser({ isPrivate: true, suffix: "private" });
});

afterAll(async () => {
  // Follow rows cascade-delete with their users (onDelete: Cascade).
  await prisma.user.deleteMany({
    where: { id: { in: [actor.id, publicUser.id, privateUser.id].filter(Boolean) } },
  });
  await prisma.$disconnect();
});

async function counts(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { followersCount: true, followingCount: true },
  });
  return u;
}

describe("followHelpers — follow state machine + counters (characterization)", () => {
  test("following a PUBLIC account auto-accepts and increments both counters", async () => {
    const before = { actor: await counts(actor.id), target: await counts(publicUser.id) };

    const result = await FollowHelper.sendFollowRequest(actor.id, publicUser.id, false);

    expect(result.status).toBe("accepted");
    expect(result.alreadyFollowing).toBe(false);

    const after = { actor: await counts(actor.id), target: await counts(publicUser.id) };
    expect(after.actor.followingCount).toBe(before.actor.followingCount + 1);
    expect(after.target.followersCount).toBe(before.target.followersCount + 1);
  });

  test("re-following the same PUBLIC account reports alreadyFollowing and does not double-count", async () => {
    const before = { actor: await counts(actor.id), target: await counts(publicUser.id) };

    const result = await FollowHelper.sendFollowRequest(actor.id, publicUser.id, false);

    expect(result.alreadyFollowing).toBe(true);
    expect(result.status).toBe("accepted");

    const after = { actor: await counts(actor.id), target: await counts(publicUser.id) };
    expect(after.actor.followingCount).toBe(before.actor.followingCount);
    expect(after.target.followersCount).toBe(before.target.followersCount);
  });

  test("following a PRIVATE account goes pending and does NOT change counters", async () => {
    const before = { actor: await counts(actor.id), target: await counts(privateUser.id) };

    const result = await FollowHelper.sendFollowRequest(actor.id, privateUser.id, true);

    expect(result.status).toBe("pending");
    expect(result.alreadyFollowing).toBe(false);

    const after = { actor: await counts(actor.id), target: await counts(privateUser.id) };
    expect(after.actor.followingCount).toBe(before.actor.followingCount);
    expect(after.target.followersCount).toBe(before.target.followersCount);
  });

  test("accepting a pending request increments both counters", async () => {
    const before = { actor: await counts(actor.id), target: await counts(privateUser.id) };

    const result = await FollowHelper.acceptRequest(actor.id, privateUser.id);

    expect(result.accepted).toBe(true);

    const after = { actor: await counts(actor.id), target: await counts(privateUser.id) };
    expect(after.actor.followingCount).toBe(before.actor.followingCount + 1);
    expect(after.target.followersCount).toBe(before.target.followersCount + 1);
  });

  test("getFollowStatus reflects the accepted relationship", async () => {
    const status = await FollowHelper.getFollowStatus(actor.id, publicUser.id);
    expect(status).toBe("accepted");
  });

  test("getFollowStatus returns null for a non-existent relationship", async () => {
    const status = await FollowHelper.getFollowStatus(publicUser.id, actor.id);
    expect(status).toBeNull();
  });

  test("getFollowers returns the actor among a target's followers with the selected profile shape", async () => {
    const { followers } = await FollowHelper.getFollowers(publicUser.id, null, 20);
    const followerIds = followers.map((f) => f.follower.id);
    expect(followerIds).toContain(actor.id);
    // The exact projected shape callers depend on:
    const row = followers.find((f) => f.follower.id === actor.id);
    expect(Object.keys(row.follower).sort()).toEqual(
      ["avatar", "fullName", "id", "isVerifiedBadge", "username"].sort()
    );
  });

  // Locks down the helper extracted from follow.controller.js in Milestone
  // 5. Must return exactly the fields the controller reads (accountStatus,
  // isPrivate, username) and null for a missing user — the same contract as
  // the Prisma findUnique it replaced.
  test("getFollowTargetSummary returns the exact selected fields for an existing user", async () => {
    const summary = await FollowHelper.getFollowTargetSummary(privateUser.id);
    expect(Object.keys(summary).sort()).toEqual(["accountStatus", "isPrivate", "username"].sort());
    expect(summary.accountStatus).toBe("active");
    expect(summary.isPrivate).toBe(true);
    expect(summary.username).toBe(privateUser.username);
  });

  test("getFollowTargetSummary returns null for a non-existent user", async () => {
    const summary = await FollowHelper.getFollowTargetSummary("00000000-0000-0000-0000-000000000000");
    expect(summary).toBeNull();
  });

  test("unfollowing an accepted relationship decrements both counters", async () => {
    const before = { actor: await counts(actor.id), target: await counts(publicUser.id) };

    const result = await FollowHelper.unfollow(actor.id, publicUser.id);

    expect(result.unfollowed).toBe(true);

    const after = { actor: await counts(actor.id), target: await counts(publicUser.id) };
    expect(after.actor.followingCount).toBe(before.actor.followingCount - 1);
    expect(after.target.followersCount).toBe(before.target.followersCount - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5 suite above never had.
// 6 of the 11 helper methods (rejectRequest, getPendingRequests,
// getFollowing, getMutualFollowers, removeAllBetween) and several state
// transitions were entirely untested. Written and run GREEN against the
// original direct-Prisma implementation BEFORE the repository migration,
// so they are a true before/after net.
//
// These describe blocks create their own fixture users rather than reusing
// the sequential actor/publicUser/privateUser above, because the follower/
// following counters are per-user mutable state and the tests above depend
// on their own ordering.
// ─────────────────────────────────────────────────────────────────────────

const MISSING = "00000000-0000-0000-0000-000000000000";
const PROFILE_KEYS = ["avatar", "fullName", "id", "isVerifiedBadge", "username"];

const scratchUserIds = [];
async function makeScratchUser({ isPrivate = false } = {}) {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: {
      fullName: `Follow P7A ${s}`,
      email: `follow-p7a-${s}@example.com`,
      username: `followp7a_${s}`,
      isPrivate,
      accountStatus: "active",
    },
  });
  scratchUserIds.push(u.id);
  return u;
}

afterAll(async () => {
  // Follow rows cascade with their users.
  await prisma.user.deleteMany({ where: { id: { in: scratchUserIds } } });
});

describe("followHelpers — request rejection & re-request (Phase 7A)", () => {
  test("rejectRequest moves a pending row to rejected and stamps rejectedAt", async () => {
    const follower = await makeScratchUser();
    const target = await makeScratchUser({ isPrivate: true });

    await FollowHelper.sendFollowRequest(follower.id, target.id, true);
    expect(await FollowHelper.getFollowStatus(follower.id, target.id)).toBe("pending");

    const before = { follower: await counts(follower.id), target: await counts(target.id) };
    const result = await FollowHelper.rejectRequest(follower.id, target.id);
    expect(result.rejected).toBe(true);

    expect(await FollowHelper.getFollowStatus(follower.id, target.id)).toBe("rejected");
    const row = await prisma.follow.findFirst({
      where: { followerId: follower.id, followingId: target.id },
    });
    expect(row.rejectedAt).toBeInstanceOf(Date);

    // rejection never touches counters
    const after = { follower: await counts(follower.id), target: await counts(target.id) };
    expect(after.follower.followingCount).toBe(before.follower.followingCount);
    expect(after.target.followersCount).toBe(before.target.followersCount);
  });

  test("rejectRequest returns { rejected: false } for a non-pending or absent row", async () => {
    const follower = await makeScratchUser();
    const target = await makeScratchUser();

    // absent
    expect(await FollowHelper.rejectRequest(follower.id, target.id)).toEqual({ rejected: false });

    // accepted (not pending)
    await FollowHelper.sendFollowRequest(follower.id, target.id, false);
    expect(await FollowHelper.rejectRequest(follower.id, target.id)).toEqual({ rejected: false });
    expect(await FollowHelper.getFollowStatus(follower.id, target.id)).toBe("accepted");
  });

  test("re-requesting after a rejection on a PUBLIC account re-accepts, clears rejectedAt, and increments", async () => {
    const follower = await makeScratchUser();
    const target = await makeScratchUser({ isPrivate: true });

    await FollowHelper.sendFollowRequest(follower.id, target.id, true);
    await FollowHelper.rejectRequest(follower.id, target.id);

    const before = { follower: await counts(follower.id), target: await counts(target.id) };
    // isPrivate=false on the retry → the rejected row is revived as accepted
    const result = await FollowHelper.sendFollowRequest(follower.id, target.id, false);
    expect(result).toEqual({ status: "accepted", alreadyFollowing: false });

    const row = await prisma.follow.findFirst({
      where: { followerId: follower.id, followingId: target.id },
    });
    expect(row.status).toBe("accepted");
    expect(row.rejectedAt).toBeNull();

    const after = { follower: await counts(follower.id), target: await counts(target.id) };
    expect(after.follower.followingCount).toBe(before.follower.followingCount + 1);
    expect(after.target.followersCount).toBe(before.target.followersCount + 1);
  });

  test("re-requesting after a rejection on a PRIVATE account goes back to pending without counting", async () => {
    const follower = await makeScratchUser();
    const target = await makeScratchUser({ isPrivate: true });

    await FollowHelper.sendFollowRequest(follower.id, target.id, true);
    await FollowHelper.rejectRequest(follower.id, target.id);

    const before = { follower: await counts(follower.id), target: await counts(target.id) };
    const result = await FollowHelper.sendFollowRequest(follower.id, target.id, true);
    expect(result).toEqual({ status: "pending", alreadyFollowing: false });

    const after = { follower: await counts(follower.id), target: await counts(target.id) };
    expect(after.follower.followingCount).toBe(before.follower.followingCount);
    expect(after.target.followersCount).toBe(before.target.followersCount);
  });

  test("re-sending a PENDING request reports alreadyFollowing without re-counting", async () => {
    const follower = await makeScratchUser();
    const target = await makeScratchUser({ isPrivate: true });

    await FollowHelper.sendFollowRequest(follower.id, target.id, true);
    const before = { follower: await counts(follower.id), target: await counts(target.id) };

    const result = await FollowHelper.sendFollowRequest(follower.id, target.id, true);
    expect(result).toEqual({ status: "pending", alreadyFollowing: true });

    const after = { follower: await counts(follower.id), target: await counts(target.id) };
    expect(after.follower.followingCount).toBe(before.follower.followingCount);
    expect(after.target.followersCount).toBe(before.target.followersCount);
  });

  test("acceptRequest returns { accepted: false } for a non-pending or absent row", async () => {
    const follower = await makeScratchUser();
    const target = await makeScratchUser();

    expect(await FollowHelper.acceptRequest(follower.id, target.id)).toEqual({ accepted: false });

    await FollowHelper.sendFollowRequest(follower.id, target.id, false); // accepted
    const before = { follower: await counts(follower.id), target: await counts(target.id) };
    expect(await FollowHelper.acceptRequest(follower.id, target.id)).toEqual({ accepted: false });

    const after = { follower: await counts(follower.id), target: await counts(target.id) };
    expect(after.follower.followingCount).toBe(before.follower.followingCount);
    expect(after.target.followersCount).toBe(before.target.followersCount);
  });
});

describe("followHelpers — unfollow edge cases (Phase 7A)", () => {
  test("unfollow on an absent relationship returns { unfollowed: false }", async () => {
    const a = await makeScratchUser();
    const b = await makeScratchUser();
    expect(await FollowHelper.unfollow(a.id, b.id)).toEqual({ unfollowed: false });
  });

  test("cancelling a PENDING request deletes the row but leaves counters alone", async () => {
    const follower = await makeScratchUser();
    const target = await makeScratchUser({ isPrivate: true });

    await FollowHelper.sendFollowRequest(follower.id, target.id, true);
    const before = { follower: await counts(follower.id), target: await counts(target.id) };

    expect(await FollowHelper.unfollow(follower.id, target.id)).toEqual({ unfollowed: true });
    expect(await FollowHelper.getFollowStatus(follower.id, target.id)).toBeNull();

    const after = { follower: await counts(follower.id), target: await counts(target.id) };
    expect(after.follower.followingCount).toBe(before.follower.followingCount);
    expect(after.target.followersCount).toBe(before.target.followersCount);
  });

  test("unfollowing a REJECTED row deletes it without touching counters", async () => {
    const follower = await makeScratchUser();
    const target = await makeScratchUser({ isPrivate: true });

    await FollowHelper.sendFollowRequest(follower.id, target.id, true);
    await FollowHelper.rejectRequest(follower.id, target.id);
    const before = { follower: await counts(follower.id), target: await counts(target.id) };

    expect(await FollowHelper.unfollow(follower.id, target.id)).toEqual({ unfollowed: true });
    expect(await FollowHelper.getFollowStatus(follower.id, target.id)).toBeNull();

    const after = { follower: await counts(follower.id), target: await counts(target.id) };
    expect(after.follower.followingCount).toBe(before.follower.followingCount);
    expect(after.target.followersCount).toBe(before.target.followersCount);
  });
});

describe("followHelpers — list queries & cursor pagination (Phase 7A)", () => {
  let hub; // public account everyone follows / that follows others
  let f1;
  let f2;
  let f3;

  beforeAll(async () => {
    hub = await makeScratchUser();
    f1 = await makeScratchUser();
    f2 = await makeScratchUser();
    f3 = await makeScratchUser();
    // three accepted followers of hub
    for (const f of [f1, f2, f3]) {
      await FollowHelper.sendFollowRequest(f.id, hub.id, false);
    }
    // hub follows all three back
    for (const f of [f1, f2, f3]) {
      await FollowHelper.sendFollowRequest(hub.id, f.id, false);
    }
  });

  test("getFollowers returns accepted followers with the follow row + nested profile", async () => {
    const { followers, nextCursor } = await FollowHelper.getFollowers(hub.id, null, 20);
    expect(followers.length).toBe(3);
    expect(followers.map((r) => r.follower.id).sort()).toEqual([f1.id, f2.id, f3.id].sort());
    expect(Object.keys(followers[0].follower).sort()).toEqual(PROFILE_KEYS.slice().sort());
    // the follow row itself is returned (not just the profile)
    expect(followers[0].status).toBe("accepted");
    expect(followers[0].followingId).toBe(hub.id);
    expect(nextCursor).toBeNull();
  });

  test("getFollowing returns accepted followees with the nested `following` profile", async () => {
    const { following, nextCursor } = await FollowHelper.getFollowing(hub.id, null, 20);
    expect(following.length).toBe(3);
    expect(following.map((r) => r.following.id).sort()).toEqual([f1.id, f2.id, f3.id].sort());
    expect(Object.keys(following[0].following).sort()).toEqual(PROFILE_KEYS.slice().sort());
    expect(following[0].followerId).toBe(hub.id);
    expect(nextCursor).toBeNull();
  });

  test("cursor pagination walks followers in id-desc order with no gaps or repeats", async () => {
    // Unlike likeHelpers/savedHelpers (which filter `id: { lt }` while
    // ordering by createdAt), these queries use Prisma's native
    // `cursor` + `skip: 1` with `orderBy: { id: "desc" }` — cursor field
    // and sort field agree, so pagination here IS deterministic.
    const page1 = await FollowHelper.getFollowers(hub.id, null, 2);
    expect(page1.followers.length).toBe(2);
    expect(page1.nextCursor).toBe(page1.followers[1].id);

    const page2 = await FollowHelper.getFollowers(hub.id, page1.nextCursor, 2);
    expect(page2.followers.length).toBe(1);
    expect(page2.nextCursor).toBeNull();

    const walked = [...page1.followers, ...page2.followers].map((r) => r.follower.id);
    expect(new Set(walked).size).toBe(3); // no repeats
    expect(walked.sort()).toEqual([f1.id, f2.id, f3.id].sort()); // no gaps

    const ids = [...page1.followers, ...page2.followers].map((r) => r.id);
    expect([...ids].sort().reverse()).toEqual(ids); // id desc preserved
  });

  test("cursor pagination walks the following list the same way", async () => {
    const page1 = await FollowHelper.getFollowing(hub.id, null, 2);
    expect(page1.following.length).toBe(2);
    const page2 = await FollowHelper.getFollowing(hub.id, page1.nextCursor, 2);
    expect(page2.following.length).toBe(1);
    expect(page2.nextCursor).toBeNull();

    const walked = [...page1.following, ...page2.following].map((r) => r.following.id);
    expect(walked.sort()).toEqual([f1.id, f2.id, f3.id].sort());
  });

  test("getPendingRequests lists only pending requesters, as bare profiles", async () => {
    const priv = await makeScratchUser({ isPrivate: true });
    const p1 = await makeScratchUser();
    const p2 = await makeScratchUser();
    const accepted = await makeScratchUser();

    await FollowHelper.sendFollowRequest(p1.id, priv.id, true);
    await FollowHelper.sendFollowRequest(p2.id, priv.id, true);
    await FollowHelper.sendFollowRequest(accepted.id, priv.id, true);
    await FollowHelper.acceptRequest(accepted.id, priv.id); // must be excluded

    const { requests, nextCursor } = await FollowHelper.getPendingRequests(priv.id, null, 20);
    expect(requests.map((r) => r.id).sort()).toEqual([p1.id, p2.id].sort());
    // returns the PROFILE, not the follow row
    expect(Object.keys(requests[0]).sort()).toEqual(PROFILE_KEYS.slice().sort());
    expect(nextCursor).toBeNull();
  });

  test("getPendingRequests paginates and returns an empty list when there are none", async () => {
    const priv = await makeScratchUser({ isPrivate: true });
    const requesters = [await makeScratchUser(), await makeScratchUser(), await makeScratchUser()];
    for (const r of requesters) await FollowHelper.sendFollowRequest(r.id, priv.id, true);

    const page1 = await FollowHelper.getPendingRequests(priv.id, null, 2);
    expect(page1.requests.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await FollowHelper.getPendingRequests(priv.id, page1.nextCursor, 2);
    expect(page2.requests.length).toBe(1);
    expect(page2.nextCursor).toBeNull();

    const walked = [...page1.requests, ...page2.requests].map((r) => r.id);
    expect(walked.sort()).toEqual(requesters.map((r) => r.id).sort());

    const none = await makeScratchUser();
    expect(await FollowHelper.getPendingRequests(none.id, null, 20)).toEqual({
      requests: [],
      nextCursor: null,
    });
  });

  test("lists exclude pending and rejected rows", async () => {
    const target = await makeScratchUser({ isPrivate: true });
    const pendingF = await makeScratchUser();
    const rejectedF = await makeScratchUser();

    await FollowHelper.sendFollowRequest(pendingF.id, target.id, true);
    await FollowHelper.sendFollowRequest(rejectedF.id, target.id, true);
    await FollowHelper.rejectRequest(rejectedF.id, target.id);

    const { followers } = await FollowHelper.getFollowers(target.id, null, 20);
    expect(followers).toEqual([]);
  });
});

describe("followHelpers — mutual followers (Phase 7A)", () => {
  test("returns users who follow BOTH accounts, as bare profiles", async () => {
    const userA = await makeScratchUser();
    const userB = await makeScratchUser();
    const mutual1 = await makeScratchUser();
    const mutual2 = await makeScratchUser();
    const onlyA = await makeScratchUser();
    const onlyB = await makeScratchUser();

    for (const m of [mutual1, mutual2]) {
      await FollowHelper.sendFollowRequest(m.id, userA.id, false);
      await FollowHelper.sendFollowRequest(m.id, userB.id, false);
    }
    await FollowHelper.sendFollowRequest(onlyA.id, userA.id, false);
    await FollowHelper.sendFollowRequest(onlyB.id, userB.id, false);

    const mutuals = await FollowHelper.getMutualFollowers(userA.id, userB.id, 10);
    expect(mutuals.map((m) => m.id).sort()).toEqual([mutual1.id, mutual2.id].sort());
    expect(Object.keys(mutuals[0]).sort()).toEqual(PROFILE_KEYS.slice().sort());
  });

  test("returns [] when the first account has no followers at all", async () => {
    const userA = await makeScratchUser();
    const userB = await makeScratchUser();
    const bFollower = await makeScratchUser();
    await FollowHelper.sendFollowRequest(bFollower.id, userB.id, false);

    expect(await FollowHelper.getMutualFollowers(userA.id, userB.id, 10)).toEqual([]);
  });

  test("respects the limit argument", async () => {
    const userA = await makeScratchUser();
    const userB = await makeScratchUser();
    for (let i = 0; i < 3; i++) {
      const m = await makeScratchUser();
      await FollowHelper.sendFollowRequest(m.id, userA.id, false);
      await FollowHelper.sendFollowRequest(m.id, userB.id, false);
    }

    const limited = await FollowHelper.getMutualFollowers(userA.id, userB.id, 2);
    expect(limited.length).toBe(2);
  });

  test("only accepted follows count as mutual", async () => {
    const userA = await makeScratchUser();
    const userB = await makeScratchUser({ isPrivate: true });
    const halfway = await makeScratchUser();

    await FollowHelper.sendFollowRequest(halfway.id, userA.id, false); // accepted
    await FollowHelper.sendFollowRequest(halfway.id, userB.id, true); // pending

    expect(await FollowHelper.getMutualFollowers(userA.id, userB.id, 10)).toEqual([]);
  });
});

describe("followHelpers — removeAllBetween (Phase 7A)", () => {
  test("removes follows in BOTH directions and decrements only for accepted rows", async () => {
    const a = await makeScratchUser();
    const b = await makeScratchUser();

    await FollowHelper.sendFollowRequest(a.id, b.id, false); // accepted a→b
    await FollowHelper.sendFollowRequest(b.id, a.id, false); // accepted b→a

    const before = { a: await counts(a.id), b: await counts(b.id) };
    expect(before.a.followingCount).toBeGreaterThanOrEqual(1);

    const result = await FollowHelper.removeAllBetween(a.id, b.id);
    expect(result).toEqual({ removed: 2 });

    expect(await FollowHelper.getFollowStatus(a.id, b.id)).toBeNull();
    expect(await FollowHelper.getFollowStatus(b.id, a.id)).toBeNull();

    const after = { a: await counts(a.id), b: await counts(b.id) };
    expect(after.a.followingCount).toBe(before.a.followingCount - 1);
    expect(after.a.followersCount).toBe(before.a.followersCount - 1);
    expect(after.b.followingCount).toBe(before.b.followingCount - 1);
    expect(after.b.followersCount).toBe(before.b.followersCount - 1);
  });

  test("a pending row is removed without any counter change", async () => {
    const a = await makeScratchUser();
    const b = await makeScratchUser({ isPrivate: true });

    await FollowHelper.sendFollowRequest(a.id, b.id, true); // pending
    const before = { a: await counts(a.id), b: await counts(b.id) };

    expect(await FollowHelper.removeAllBetween(a.id, b.id)).toEqual({ removed: 1 });
    expect(await FollowHelper.getFollowStatus(a.id, b.id)).toBeNull();

    const after = { a: await counts(a.id), b: await counts(b.id) };
    expect(after.a.followingCount).toBe(before.a.followingCount);
    expect(after.b.followersCount).toBe(before.b.followersCount);
  });

  test("returns { removed: 0 } when the two users have no relationship", async () => {
    const a = await makeScratchUser();
    const b = await makeScratchUser();
    expect(await FollowHelper.removeAllBetween(a.id, b.id)).toEqual({ removed: 0 });
  });

  test("is unaffected by the users' other follow relationships", async () => {
    const a = await makeScratchUser();
    const b = await makeScratchUser();
    const bystander = await makeScratchUser();

    await FollowHelper.sendFollowRequest(a.id, b.id, false);
    await FollowHelper.sendFollowRequest(a.id, bystander.id, false); // must survive

    expect(await FollowHelper.removeAllBetween(a.id, b.id)).toEqual({ removed: 1 });
    expect(await FollowHelper.getFollowStatus(a.id, bystander.id)).toBe("accepted");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY HAZARD REGRESSION (Phase 7A Milestone 3)
//
// BaseRepository.findMany(filter) routes through toPrismaPagination(), and
// normalizePagination() defaults `limit` to 20 — so `findMany(filter)` with
// no pagination argument SILENTLY CAPS AT 20 ROWS despite reading like an
// unbounded query.
//
// This is the single most dangerous trap for the remaining Phase 7A helper
// migrations: two followHelpers queries (getMutualFollowers' candidate set
// and removeAllBetween's row sweep) are intentionally unbounded, and naively
// routing either through findMany() would have silently changed behavior
// with no test failure at small fixture sizes. followHelpers therefore uses
// dedicated unbounded repository methods instead.
//
// The cap is NOT "fixed" here — changing the default would be a redesign of
// an existing repository API with other future callers. It is pinned by this
// test so the constraint is executable knowledge rather than a comment, and
// so a future change to the default fails loudly here.
// ─────────────────────────────────────────────────────────────────────────
describe("FollowRepository — findMany default pagination cap (Phase 7A hazard)", () => {
  const CAP = 20;
  let hub;
  let followerCount;

  beforeAll(async () => {
    hub = await makeScratchUser();
    followerCount = CAP + 3; // deliberately more than the default cap
    for (let i = 0; i < followerCount; i++) {
      const f = await makeScratchUser();
      await FollowHelper.sendFollowRequest(f.id, hub.id, false);
    }
  });

  test("findMany(filter) with no pagination silently caps at the default limit", async () => {
    const capped = await followRepository.findMany({ followingId: hub.id, status: "accepted" });
    expect(capped.length).toBe(CAP);
    expect(capped.length).toBeLessThan(followerCount); // rows were dropped
  });

  test("findAllFollowerIds is genuinely unbounded — the reason it exists", async () => {
    const all = await followRepository.findAllFollowerIds(hub.id, { status: "accepted" });
    expect(all.length).toBe(followerCount);
    expect(Object.keys(all[0])).toEqual(["followerId"]); // projection preserved
  });

  test("getMutualFollowers is computed from the FULL follower set, not a capped one", async () => {
    // Every one of hub's followers also follows `other`, so a correct
    // implementation finds all of them; one built on findMany() would
    // silently top out at the 20-row cap.
    const other = await makeScratchUser();
    const hubFollowers = await followRepository.findAllFollowerIds(hub.id, { status: "accepted" });
    for (const { followerId } of hubFollowers) {
      await FollowHelper.sendFollowRequest(followerId, other.id, false);
    }

    const mutuals = await FollowHelper.getMutualFollowers(hub.id, other.id, 100);
    expect(mutuals.length).toBe(followerCount);
    expect(mutuals.length).toBeGreaterThan(CAP); // proves no silent truncation
  });

  test("findAllBetween is unbounded so removeAllBetween cannot leave rows behind", async () => {
    const a = await makeScratchUser();
    const b = await makeScratchUser();
    await FollowHelper.sendFollowRequest(a.id, b.id, false);
    await FollowHelper.sendFollowRequest(b.id, a.id, false);

    const rows = await followRepository.findAllBetween(a.id, b.id);
    expect(rows.length).toBe(2); // both directions, no pagination applied
    expect(rows.every((r) => r.id && r.status)).toBe(true); // full rows, not projections
  });
});
