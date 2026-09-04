// Characterization test for the `group` domain (Milestone 5J — final non-admin).
// group.controller.js has 14 direct Prisma call-sites and NO existing helper
// of its own; messageHelpers.js is the established owner of conversation /
// participant persistence, so the baseline characterizes current behavior via
// exact inline mirrors, and the extracted helpers are verified after.
//
// EXTERNAL SERVICES: none. group.controller.js imports only asyncHandler,
// AppError and prisma — no notifyChat, no socket emits, no Redis, no media
// upload, no HTTP. Nothing to isolate; these tests are inherently offline.
//
// ATOMICITY (special check, documented — behavior preserved, NOT changed):
//   • create group      — ATOMIC (single conversation.create with nested members.create)
//   • add member        — intentionally non-atomic: findFirst guard → upsert.
//                         The upsert is idempotent on the unique key, which is
//                         the real protection against the guard's TOCTOU race.
//   • remove / leave    — single updateMany write (guard is read-only)
//   • transfer admin    — single conversation.update (guard is read-only)
//   • disband           — single update(isActive:false); members intentionally
//                         left in place (soft disband, not a cascade delete)
//   No operation performs 2+ writes that must succeed together.
import { PrismaClient } from "@prisma/client";
import * as GroupHelper from "../../src/utils/messageHelpers.js";

const prisma = new PrismaClient();

const userIds = [];
const convIds = [];

const memberInclude = {
  members: {
    where: { isDeleted: false },
    include: {
      user: {
        select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true, accountStatus: true },
      },
    },
  },
};

async function makeUser() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({ data: { fullName: `G ${s}`, email: `g-${s}@e.com`, username: `g_${s}`, accountStatus: "active" } });
  userIds.push(u.id);
  return u;
}

// Inline mirror of createGroupConversation's create (byte-identical shape).
async function inlineCreateGroup(adminId, participantIds, groupName = "Test Group", avatarUrl = null) {
  const allParticipants = [...new Set([adminId, ...participantIds])];
  const conv = await prisma.conversation.create({
    data: {
      isGroup: true,
      groupName: groupName.trim(),
      groupAdmin: { connect: { id: adminId } },
      groupAvatar: avatarUrl ? { url: avatarUrl, publicId: null } : null,
      members: { create: allParticipants.map((userId) => ({ userId })) },
    },
    include: memberInclude,
  });
  convIds.push(conv.id);
  return conv;
}

let owner, memberA, memberB, outsider;

beforeAll(async () => {
  owner = await makeUser();
  memberA = await makeUser();
  memberB = await makeUser();
  outsider = await makeUser();
});

afterAll(async () => {
  await prisma.conversationParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
  await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("group creation (inline mirror)", () => {
  test("creates a group atomically with admin + all participants as members", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id, memberB.id], "Marble Crew");
    expect(conv.isGroup).toBe(true);
    expect(conv.groupName).toBe("Marble Crew");
    expect(conv.groupAdminId).toBe(owner.id);
    const ids = conv.members.map((m) => m.userId).sort();
    expect(ids).toEqual([owner.id, memberA.id, memberB.id].sort());
    // member rows exist in the DB — nested create committed with the parent
    expect(await prisma.conversationParticipant.count({ where: { conversationId: conv.id } })).toBe(3);
  });

  test("de-duplicates the admin if also passed as a participant", async () => {
    const conv = await inlineCreateGroup(owner.id, [owner.id, memberA.id]);
    expect(conv.members.length).toBe(2); // owner counted once
  });

  test("participant-existence check finds all real ids and misses a fake one", async () => {
    const real = [memberA.id, memberB.id];
    const found = await prisma.user.findMany({ where: { id: { in: real } }, select: { id: true } });
    expect(found.length).toBe(real.length);
    const withFake = await prisma.user.findMany({
      where: { id: { in: [memberA.id, "00000000-0000-0000-0000-000000000000"] } },
      select: { id: true },
    });
    expect(withFake.length).not.toBe(2); // triggers the controller's 404
  });
});

describe("conversation lookups & authorization data (inline mirror)", () => {
  test("guard lookup returns { id, isGroup, groupAdmin } — identifies owner vs non-owner", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    const guard = await prisma.conversation.findUnique({
      where: { id: conv.id },
      select: { id: true, isGroup: true, groupAdmin: true },
    });
    expect(Object.keys(guard).sort()).toEqual(["groupAdmin", "id", "isGroup"].sort());
    expect(guard.isGroup).toBe(true);
    // groupAdmin comes back as a relation object here; controller's getAdminId normalizes it
    const adminId = typeof guard.groupAdmin === "object" && guard.groupAdmin !== null ? guard.groupAdmin.id : guard.groupAdmin;
    expect(adminId).toBe(owner.id);
    expect(adminId).not.toBe(memberA.id); // non-owner => 403 path
  });

  test("guard lookup returns null for a missing conversation (404 path)", async () => {
    expect(await prisma.conversation.findUnique({
      where: { id: "00000000-0000-0000-0000-000000000000" },
      select: { id: true, isGroup: true, groupAdmin: true },
    })).toBeNull();
  });

  test("a 1:1 (non-group) conversation is distinguishable — drives the 400 'Not a group' path", async () => {
    const key = [owner.id, outsider.id].sort().join(":");
    const dm = await prisma.conversation.create({
      data: { isGroup: false, participantsKey: key, members: { create: [{ userId: owner.id }, { userId: outsider.id }] } },
    });
    convIds.push(dm.id);
    const guard = await prisma.conversation.findUnique({ where: { id: dm.id }, select: { id: true, isGroup: true, groupAdmin: true } });
    expect(guard.isGroup).toBe(false);
  });

  test("membership lookup returns only non-deleted members (leave/transfer guard)", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id, memberB.id]);
    await prisma.conversationParticipant.updateMany({ where: { conversationId: conv.id, userId: memberB.id }, data: { isDeleted: true } });
    const withMembers = await prisma.conversation.findUnique({
      where: { id: conv.id },
      select: { id: true, isGroup: true, members: { where: { isDeleted: false }, select: { userId: true } } },
    });
    const ids = withMembers.members.map((m) => m.userId);
    expect(ids).toContain(owner.id);
    expect(ids).toContain(memberA.id);
    expect(ids).not.toContain(memberB.id); // removed member no longer counts
  });
});

describe("member management (inline mirror)", () => {
  test("add member: existing-member guard, upsert, and re-fetch", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);

    // not yet a member
    expect(await prisma.conversationParticipant.findFirst({
      where: { conversationId: conv.id, userId: outsider.id, isDeleted: false },
    })).toBeNull();

    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: outsider.id } },
      update: { isDeleted: false },
      create: { conversationId: conv.id, userId: outsider.id },
    });

    // now the guard finds them (the controller's "already a member" 400 path)
    expect(await prisma.conversationParticipant.findFirst({
      where: { conversationId: conv.id, userId: outsider.id, isDeleted: false },
    })).not.toBeNull();

    const updated = await prisma.conversation.findUnique({ where: { id: conv.id }, include: memberInclude });
    expect(updated.members.map((m) => m.userId)).toContain(outsider.id);
    expect(updated.members[0].user).toHaveProperty("username"); // include shape preserved
  });

  test("add member: upsert re-activates a previously removed member (isDeleted -> false)", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    await prisma.conversationParticipant.updateMany({ where: { conversationId: conv.id, userId: memberA.id }, data: { isDeleted: true } });

    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: memberA.id } },
      update: { isDeleted: false },
      create: { conversationId: conv.id, userId: memberA.id },
    });

    const row = await prisma.conversationParticipant.findFirst({ where: { conversationId: conv.id, userId: memberA.id } });
    expect(row.isDeleted).toBe(false);
    // upsert did NOT create a duplicate row
    expect(await prisma.conversationParticipant.count({ where: { conversationId: conv.id, userId: memberA.id } })).toBe(1);
  });

  test("remove member: soft-deletes the participant row", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id, memberB.id]);
    await prisma.conversationParticipant.updateMany({ where: { conversationId: conv.id, userId: memberA.id }, data: { isDeleted: true } });
    const updated = await prisma.conversation.findUnique({ where: { id: conv.id }, include: memberInclude });
    expect(updated.members.map((m) => m.userId)).not.toContain(memberA.id);
    // row still exists (soft delete, not hard delete)
    expect(await prisma.conversationParticipant.count({ where: { conversationId: conv.id, userId: memberA.id } })).toBe(1);
  });

  test("leave group: member soft-deletes themselves; non-member is not a member (403 path)", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    const guard = await prisma.conversation.findUnique({
      where: { id: conv.id },
      select: { id: true, isGroup: true, members: { where: { isDeleted: false }, select: { userId: true } } },
    });
    expect(guard.members.some((m) => m.userId === outsider.id)).toBe(false); // outsider => 403

    await prisma.conversationParticipant.updateMany({ where: { conversationId: conv.id, userId: memberA.id }, data: { isDeleted: true } });
    const after = await prisma.conversation.findUnique({
      where: { id: conv.id },
      select: { members: { where: { isDeleted: false }, select: { userId: true } } },
    });
    expect(after.members.map((m) => m.userId)).not.toContain(memberA.id);
  });

  test("empty group: all members can leave, conversation still exists", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    await prisma.conversationParticipant.updateMany({ where: { conversationId: conv.id }, data: { isDeleted: true } });
    const after = await prisma.conversation.findUnique({
      where: { id: conv.id },
      select: { id: true, members: { where: { isDeleted: false }, select: { userId: true } } },
    });
    expect(after.id).toBe(conv.id); // conversation row survives
    expect(after.members).toEqual([]); // no active members
  });
});

describe("rename, admin transfer, disband (inline mirror)", () => {
  test("rename updates groupName and/or groupAvatar", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id], "Old Name");
    const updated = await prisma.conversation.update({
      where: { id: conv.id },
      data: { groupName: "New Name", groupAvatar: { url: "http://x/g.jpg", publicId: null } },
    });
    expect(updated.groupName).toBe("New Name");
    expect(updated.groupAvatar).toEqual({ url: "http://x/g.jpg", publicId: null });
  });

  test("transfer admin connects a new admin who must be an active member", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    const guard = await prisma.conversation.findUnique({
      where: { id: conv.id },
      select: { id: true, isGroup: true, groupAdmin: true, members: { where: { isDeleted: false }, select: { userId: true } } },
    });
    expect(guard.members.some((m) => m.userId === memberA.id)).toBe(true);
    expect(guard.members.some((m) => m.userId === outsider.id)).toBe(false); // non-member => 400

    const updated = await prisma.conversation.update({
      where: { id: conv.id },
      data: { groupAdmin: { connect: { id: memberA.id } } },
      include: memberInclude,
    });
    expect(updated.groupAdminId).toBe(memberA.id);
  });

  test("disband sets isActive false and intentionally leaves members in place", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    const before = await prisma.conversationParticipant.count({ where: { conversationId: conv.id } });

    await prisma.conversation.update({ where: { id: conv.id }, data: { isActive: false } });

    const after = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { isActive: true } });
    expect(after.isActive).toBe(false);
    // members are NOT cascade-deleted — documented existing behavior
    expect(await prisma.conversationParticipant.count({ where: { conversationId: conv.id } })).toBe(before);
  });

  test("deleted (disbanded) group is still findable — controller relies on isActive, not absence", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    await prisma.conversation.update({ where: { id: conv.id }, data: { isActive: false } });
    const guard = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { id: true, isGroup: true, groupAdmin: true } });
    expect(guard).not.toBeNull(); // still returns a row, so admin ops still resolve
  });
});

// After extraction: the 11 helpers must match the inline behavior exactly.
describe("messageHelpers — extracted group queries match inline behavior", () => {
  const MISSING = "00000000-0000-0000-0000-000000000000";

  test("findUsersByIds returns { id } rows for existing users only", async () => {
    const found = await GroupHelper.findUsersByIds([memberA.id, memberB.id]);
    expect(found.length).toBe(2);
    expect(Object.keys(found[0])).toEqual(["id"]);
    expect((await GroupHelper.findUsersByIds([memberA.id, MISSING])).length).toBe(1);
  });

  test("createGroupConversation creates the group atomically with members", async () => {
    const conv = await GroupHelper.createGroupConversation({
      groupName: "  Helper Group  ",
      adminId: owner.id,
      avatarUrl: "http://x/g.jpg",
      allParticipants: [owner.id, memberA.id],
    });
    convIds.push(conv.id);
    expect(conv.isGroup).toBe(true);
    expect(conv.groupName).toBe("Helper Group"); // trimmed
    expect(conv.groupAdminId).toBe(owner.id);
    expect(conv.groupAvatar).toEqual({ url: "http://x/g.jpg", publicId: null });
    expect(conv.members.map((m) => m.userId).sort()).toEqual([owner.id, memberA.id].sort());
    expect(conv.members[0].user).toHaveProperty("username"); // include shape
  });

  test("createGroupConversation stores null avatar when none supplied", async () => {
    const conv = await GroupHelper.createGroupConversation({
      groupName: "No Avatar", adminId: owner.id, avatarUrl: null, allParticipants: [owner.id, memberA.id],
    });
    convIds.push(conv.id);
    expect(conv.groupAvatar).toBeNull();
  });

  test("getGroupForAdminCheck returns the guard shape; null for missing", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    const guard = await GroupHelper.getGroupForAdminCheck(conv.id);
    expect(Object.keys(guard).sort()).toEqual(["groupAdmin", "id", "isGroup"].sort());
    expect(await GroupHelper.getGroupForAdminCheck(MISSING)).toBeNull();
  });

  test("getGroupWithMembers / getGroupForAdminTransfer return active members", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id, memberB.id]);
    await GroupHelper.softDeleteGroupMember(conv.id, memberB.id);

    const withMembers = await GroupHelper.getGroupWithMembers(conv.id);
    expect(Object.keys(withMembers).sort()).toEqual(["id", "isGroup", "members"].sort());
    expect(withMembers.members.map((m) => m.userId)).not.toContain(memberB.id);

    const forTransfer = await GroupHelper.getGroupForAdminTransfer(conv.id);
    expect(Object.keys(forTransfer).sort()).toEqual(["groupAdmin", "id", "isGroup", "members"].sort());
    expect(forTransfer.members.map((m) => m.userId)).toContain(memberA.id);
    expect(await GroupHelper.getGroupWithMembers(MISSING)).toBeNull();
  });

  test("findActiveGroupMember / upsertGroupMember / softDeleteGroupMember round-trip", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    expect(await GroupHelper.findActiveGroupMember(conv.id, outsider.id)).toBeNull();

    await GroupHelper.upsertGroupMember(conv.id, outsider.id);
    expect(await GroupHelper.findActiveGroupMember(conv.id, outsider.id)).not.toBeNull();

    await GroupHelper.softDeleteGroupMember(conv.id, outsider.id);
    expect(await GroupHelper.findActiveGroupMember(conv.id, outsider.id)).toBeNull();

    // upsert re-activates without duplicating
    await GroupHelper.upsertGroupMember(conv.id, outsider.id);
    expect(await prisma.conversationParticipant.count({ where: { conversationId: conv.id, userId: outsider.id } })).toBe(1);
  });

  test("getGroupWithMemberDetails returns populated members", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);
    const details = await GroupHelper.getGroupWithMemberDetails(conv.id);
    expect(details.members.length).toBe(2);
    expect(details.members[0].user).toHaveProperty("accountStatus");
  });

  test("updateGroupInfo / updateGroupAdmin / deactivateGroupConversation apply their writes", async () => {
    const conv = await inlineCreateGroup(owner.id, [memberA.id]);

    const renamed = await GroupHelper.updateGroupInfo(conv.id, { groupName: "Renamed" });
    expect(renamed.groupName).toBe("Renamed");

    const transferred = await GroupHelper.updateGroupAdmin(conv.id, memberA.id);
    expect(transferred.groupAdminId).toBe(memberA.id);
    expect(transferred.members.length).toBe(2); // include preserved

    const membersBefore = await prisma.conversationParticipant.count({ where: { conversationId: conv.id } });
    await GroupHelper.deactivateGroupConversation(conv.id);
    const after = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { isActive: true } });
    expect(after.isActive).toBe(false);
    expect(await prisma.conversationParticipant.count({ where: { conversationId: conv.id } })).toBe(membersBefore);
  });
});
