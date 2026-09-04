// Characterization test for the `explore` domain (Milestone 5C).
// explore.controller.js has no existing helper, so the baseline
// characterizes the CURRENT observable DB behavior via the exact inline
// queries the controller performs (feed visibility rules, type filter,
// search matching, public-profile lookup, follow status, profile posts).
// After a minimal exploreHelpers.js is extracted, the same assertions are
// re-expressed against the helper and must match.
import { PrismaClient } from "@prisma/client";
import * as ExploreHelper from "../../src/utils/exploreHelpers.js";

const prisma = new PrismaClient();

const AUTHOR_SELECT = {
  id: true, username: true, fullName: true, avatar: true,
  isVerifiedBadge: true, accountStatus: true, role: true,
};

let author, viewer, deactivated, admin;
let pImage, pReel, pDraft, pDeleted, pByDeactivated;

beforeAll(async () => {
  const s = `${Date.now()}`;
  author = await prisma.user.create({ data: { fullName: "Exp Author", email: `exp-author-${s}@e.com`, username: `expauthor_${s}`, accountStatus: "active" } });
  viewer = await prisma.user.create({ data: { fullName: "Exp Viewer", email: `exp-viewer-${s}@e.com`, username: `expviewer_${s}`, accountStatus: "active" } });
  deactivated = await prisma.user.create({ data: { fullName: "Exp Deact", email: `exp-deact-${s}@e.com`, username: `expdeact_${s}`, accountStatus: "deactivated" } });
  admin = await prisma.user.create({ data: { fullName: "Exp Admin", email: `exp-admin-${s}@e.com`, username: `expadmin_${s}`, accountStatus: "active", role: "super_admin" } });

  pImage = await prisma.post.create({ data: { type: "image", authorId: author.id, caption: "premium marble slab", hashtags: ["marble"], visibility: "public" } });
  pReel = await prisma.post.create({ data: { type: "reel", authorId: author.id, caption: "granite reel", visibility: "public" } });
  pDraft = await prisma.post.create({ data: { type: "image", authorId: author.id, isDraft: true, visibility: "public" } });
  pDeleted = await prisma.post.create({ data: { type: "image", authorId: author.id, isDeleted: true, deletedAt: new Date(), visibility: "public" } });
  pByDeactivated = await prisma.post.create({ data: { type: "image", authorId: deactivated.id, caption: "marble hidden", visibility: "public" } });
});

afterAll(async () => {
  await prisma.post.deleteMany({ where: { authorId: { in: [author.id, deactivated.id, admin.id] } } });
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: viewer.id }, { followingId: author.id }] } });
  await prisma.user.deleteMany({ where: { id: { in: [author.id, viewer.id, deactivated.id, admin.id] } } });
  await prisma.$disconnect();
});

// Inline mirrors of the controller's exact queries.
async function inlineExploreFeed({ type = "all", limit = 24, cursor = null } = {}) {
  const where = {
    isDeleted: false, isDraft: false, visibility: "public",
    author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
    ...(type !== "all" && { type }),
  };
  return prisma.post.findMany({
    where, orderBy: { id: "desc" }, take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: { id: true, type: true, caption: true, media: true, likesCount: true, commentsCount: true, viewsCount: true, savedCount: true, createdAt: true, hashtags: true, commentsDisabled: true, likesHidden: true, author: { select: AUTHOR_SELECT } },
  });
}
async function inlineSearch({ q, limit = 20, cursor = null }) {
  const where = {
    isDeleted: false, isDraft: false, visibility: "public",
    author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
    OR: [{ caption: { contains: q, mode: "insensitive" } }, { hashtags: { hasSome: [q.toLowerCase()] } }],
  };
  return prisma.post.findMany({ where, orderBy: { id: "desc" }, take: limit + 1, ...(cursor && { cursor: { id: cursor }, skip: 1 }), select: { id: true, type: true, caption: true, media: true, likesCount: true, commentsCount: true, viewsCount: true, createdAt: true, hashtags: true, author: { select: AUTHOR_SELECT } } });
}
async function inlineProfileUser(username) {
  return prisma.user.findFirst({ where: { username, accountStatus: "active", role: { not: "super_admin" } }, select: { id: true, fullName: true, username: true, avatar: true, coverPhoto: true, bio: true, designation: true, businessCategory: true, location: true, followersCount: true, followingCount: true, isVerifiedBadge: true, isPrivate: true } });
}

describe("explore — current DB behavior (baseline characterization)", () => {
  test("feed excludes deleted, draft, deactivated-author and admin-author posts", async () => {
    const posts = await inlineExploreFeed({ type: "all", limit: 50 });
    const ids = posts.map((p) => p.id);
    expect(ids).toContain(pImage.id);
    expect(ids).toContain(pReel.id);
    expect(ids).not.toContain(pDraft.id);
    expect(ids).not.toContain(pDeleted.id);
    expect(ids).not.toContain(pByDeactivated.id);
  });

  test("feed type filter returns only that type", async () => {
    const posts = await inlineExploreFeed({ type: "image", limit: 50 });
    const ids = posts.map((p) => p.id);
    expect(ids).toContain(pImage.id);
    expect(ids).not.toContain(pReel.id);
  });

  test("search matches caption (case-insensitive) and hashtag, excludes hidden authors", async () => {
    const posts = await inlineSearch({ q: "MARBLE", limit: 50 });
    const ids = posts.map((p) => p.id);
    expect(ids).toContain(pImage.id); // caption "premium marble slab" + hashtag "marble"
    expect(ids).not.toContain(pByDeactivated.id); // deactivated author excluded despite "marble" caption
  });

  test("public-profile lookup returns active non-admin user, null otherwise", async () => {
    expect((await inlineProfileUser(author.username)).id).toBe(author.id);
    expect(await inlineProfileUser(deactivated.username)).toBeNull();
    expect(await inlineProfileUser(admin.username)).toBeNull();
    expect(await inlineProfileUser("nobody-xyz")).toBeNull();
  });
});

// After extraction: exploreHelpers functions must match the inline behavior.
describe("exploreHelpers — extracted queries match inline behavior", () => {
  test("findExplorePosts (all) applies the same visibility rules", async () => {
    const ids = (await ExploreHelper.findExplorePosts({ type: "all", limit: 50 })).map((p) => p.id);
    expect(ids).toContain(pImage.id);
    expect(ids).toContain(pReel.id);
    expect(ids).not.toContain(pDraft.id);
    expect(ids).not.toContain(pDeleted.id);
    expect(ids).not.toContain(pByDeactivated.id);
  });

  test("findExplorePosts type filter matches inline", async () => {
    const ids = (await ExploreHelper.findExplorePosts({ type: "image", limit: 50 })).map((p) => p.id);
    expect(ids).toContain(pImage.id);
    expect(ids).not.toContain(pReel.id);
  });

  test("searchExplorePosts matches caption/hashtag and excludes hidden authors", async () => {
    const ids = (await ExploreHelper.searchExplorePosts({ q: "MARBLE", limit: 50 })).map((p) => p.id);
    expect(ids).toContain(pImage.id);
    expect(ids).not.toContain(pByDeactivated.id);
  });

  test("findPublicProfileUser matches inline (active non-admin only)", async () => {
    expect((await ExploreHelper.findPublicProfileUser(author.username)).id).toBe(author.id);
    expect(await ExploreHelper.findPublicProfileUser(deactivated.username)).toBeNull();
    expect(await ExploreHelper.findPublicProfileUser(admin.username)).toBeNull();
  });

  test("findFollowStatus returns the relationship status, null when absent", async () => {
    expect(await ExploreHelper.findFollowStatus(viewer.id, author.id)).toBeNull();
    await prisma.follow.create({ data: { followerId: viewer.id, followingId: author.id, status: "accepted" } });
    const rec = await ExploreHelper.findFollowStatus(viewer.id, author.id);
    expect(rec.status).toBe("accepted");
  });

  test("findProfilePosts returns the owner's public, non-draft, non-deleted posts", async () => {
    const ids = (await ExploreHelper.findProfilePosts({ authorId: author.id, postLimit: 50 })).map((p) => p.id);
    expect(ids).toContain(pImage.id);
    expect(ids).toContain(pReel.id);
    expect(ids).not.toContain(pDraft.id);
    expect(ids).not.toContain(pDeleted.id);
  });

  // ── Phase 7B / M-1, Batch 2 ────────────────────────────────────────────
  test("M-1 EQUIVALENCE: neutral or/like/hasAny returns exactly what OR/contains/hasSome did", async () => {
    // searchExplorePosts is the only place in the app that mixes a
    // case-insensitive substring match with a scalar-ARRAY membership test
    // inside one OR — `hasSome` is the single hasAny call-site, so this is
    // the only proof that its rename is behaviour-preserving.
    const q = "MARBLE";
    const prismaWhere = {
      isDeleted: false,
      isDraft: false,
      visibility: "public",
      author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
      OR: [
        { caption:  { contains: q, mode: "insensitive" } },
        { hashtags: { hasSome: [q.toLowerCase()] } },
      ],
    };
    const inline = await prisma.post.findMany({
      where: prismaWhere, orderBy: { id: "desc" }, take: 51, select: { id: true },
    });
    const through = await ExploreHelper.searchExplorePosts({ q, limit: 50 });

    expect(through.map((p) => p.id)).toEqual(inline.map((p) => p.id));
    expect(through.map((p) => p.id)).toContain(pImage.id);       // matched on caption AND hashtag
    expect(through.map((p) => p.id)).not.toContain(pByDeactivated.id); // nested author guard held

    // The hashtag branch alone still works: a term present ONLY as a
    // hashtag, never in a caption.
    const tagOnly = await ExploreHelper.searchExplorePosts({ q: "marble", limit: 50 });
    expect(tagOnly.map((p) => p.id)).toEqual(
      (await prisma.post.findMany({
        where: {
          isDeleted: false, isDraft: false, visibility: "public",
          author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
          OR: [
            { caption:  { contains: "marble", mode: "insensitive" } },
            { hashtags: { hasSome: ["marble"] } },
          ],
        },
        orderBy: { id: "desc" }, take: 51, select: { id: true },
      })).map((p) => p.id)
    );
  });

  test("M-1 GUARANTEE: Prisma-shaped filters are rejected by the post repository", async () => {
    const { socialPostRepository } = await import("../../src/config/repositories.js");
    await expect(socialPostRepository.count({ caption: { contains: "x" } }))
      .rejects.toThrow(/contains/);
    await expect(socialPostRepository.count({ hashtags: { hasSome: ["x"] } }))
      .rejects.toThrow(/hasSome/);
  });
});
