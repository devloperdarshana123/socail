// Characterization test for the `notification` domain (Phase 7A Milestone 11).
//
// notificationHelpers.js had NO characterization suite. This file is written
// from scratch and run GREEN against the ORIGINAL direct-Prisma
// implementation BEFORE the repository migration, establishing the
// before/after net.
//
// NO NETWORK: notificationHelpers is pure persistence — push/socket delivery
// lives in chat-server and the controller's orchestration, never here.
import { PrismaClient } from "@prisma/client";
import * as NotifHelper from "../../src/utils/notificationHelpers.js";

const prisma = new PrismaClient();

const MISSING = "00000000-0000-0000-0000-000000000000";
const userIds = [];
const notificationIds = [];

async function makeUser() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: { fullName: `N ${s}`, email: `n-${s}@e.com`, username: `n_${s}`, accountStatus: "active" },
  });
  userIds.push(u.id);
  return u;
}

async function makeNotification(receiverId, senderId, extra = {}) {
  const n = await prisma.notification.create({
    data: { receiverId, senderId, type: "like", ...extra },
  });
  notificationIds.push(n.id);
  return n;
}

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { receiverId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("notificationHelpers — inbox listing & projection", () => {
  test("returns the receiver's notifications newest-first with the sender projection", async () => {
    const receiver = await makeUser();
    const sender = await makeUser();
    await makeNotification(receiver.id, sender.id, { type: "like" });
    await new Promise((r) => setTimeout(r, 5));
    const newest = await makeNotification(receiver.id, sender.id, { type: "comment" });

    const inbox = await NotifHelper.getInbox(receiver.id, 1, 20);

    expect(inbox.length).toBe(2);
    expect(inbox[0].id).toBe(newest.id); // createdAt desc
    expect(Object.keys(inbox[0]).sort()).toEqual(
      ["id", "type", "isRead", "createdAt", "sender"].sort()
    );
    expect(Object.keys(inbox[0].sender).sort()).toEqual(
      ["avatar", "fullName", "id", "isVerifiedBadge", "username"].sort()
    );
    // fields deliberately NOT projected
    expect(inbox[0].receiverId).toBeUndefined();
    expect(inbox[0].isDeleted).toBeUndefined();
  });

  test("excludes soft-deleted notifications and other users' notifications", async () => {
    const receiver = await makeUser();
    const other = await makeUser();
    const sender = await makeUser();
    const keep = await makeNotification(receiver.id, sender.id);
    await makeNotification(receiver.id, sender.id, { isDeleted: true });
    await makeNotification(other.id, sender.id);

    const inbox = await NotifHelper.getInbox(receiver.id, 1, 20);
    expect(inbox.map((n) => n.id)).toEqual([keep.id]);
  });

  test("paginates by page/limit with no overlap between pages", async () => {
    const receiver = await makeUser();
    const sender = await makeUser();
    const made = [];
    for (let i = 0; i < 5; i++) {
      made.push(await makeNotification(receiver.id, sender.id));
      await new Promise((r) => setTimeout(r, 5));
    }

    const page1 = await NotifHelper.getInbox(receiver.id, 1, 2);
    const page2 = await NotifHelper.getInbox(receiver.id, 2, 2);
    const page3 = await NotifHelper.getInbox(receiver.id, 3, 2);

    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    expect(page3.length).toBe(1);

    const ids = [...page1, ...page2, ...page3].map((n) => n.id);
    expect(new Set(ids).size).toBe(5); // no repeats, no gaps
  });

  test("defaults to page 1 / limit 20 and returns [] for an empty inbox", async () => {
    const empty = await makeUser();
    expect(await NotifHelper.getInbox(empty.id)).toEqual([]);

    const receiver = await makeUser();
    const sender = await makeUser();
    for (let i = 0; i < 3; i++) await makeNotification(receiver.id, sender.id);
    expect((await NotifHelper.getInbox(receiver.id)).length).toBe(3);
  });

  test("a notification with no sender still lists (sender is null)", async () => {
    const receiver = await makeUser();
    const n = await makeNotification(receiver.id, null, { type: "system" });

    const inbox = await NotifHelper.getInbox(receiver.id, 1, 20);
    expect(inbox.map((x) => x.id)).toContain(n.id);
    expect(inbox.find((x) => x.id === n.id).sender).toBeNull();
  });
});

describe("notificationHelpers — unread counts", () => {
  test("counts only unread, non-deleted notifications for that receiver", async () => {
    const receiver = await makeUser();
    const other = await makeUser();
    const sender = await makeUser();

    await makeNotification(receiver.id, sender.id); // unread
    await makeNotification(receiver.id, sender.id); // unread
    await makeNotification(receiver.id, sender.id, { isRead: true }); // read
    await makeNotification(receiver.id, sender.id, { isDeleted: true }); // deleted
    await makeNotification(other.id, sender.id); // someone else's

    expect(await NotifHelper.getUnreadCount(receiver.id)).toBe(2);
  });

  test("is 0 for a user with no notifications", async () => {
    const u = await makeUser();
    expect(await NotifHelper.getUnreadCount(u.id)).toBe(0);
  });
});

describe("notificationHelpers — marking read", () => {
  test("markAllAsRead flips only that user's unread, non-deleted rows", async () => {
    const receiver = await makeUser();
    const other = await makeUser();
    const sender = await makeUser();
    const a = await makeNotification(receiver.id, sender.id);
    const deleted = await makeNotification(receiver.id, sender.id, { isDeleted: true });
    const theirs = await makeNotification(other.id, sender.id);

    const result = await NotifHelper.markAllAsRead(receiver.id);
    expect(result.count).toBe(1);

    expect((await prisma.notification.findUnique({ where: { id: a.id } })).isRead).toBe(true);
    // a soft-deleted row is left alone
    expect((await prisma.notification.findUnique({ where: { id: deleted.id } })).isRead).toBe(false);
    expect((await prisma.notification.findUnique({ where: { id: theirs.id } })).isRead).toBe(false);

    // running again is a no-op
    expect((await NotifHelper.markAllAsRead(receiver.id)).count).toBe(0);
  });

  test("markOneAsRead marks the owner's notification and returns it", async () => {
    const receiver = await makeUser();
    const sender = await makeUser();
    const n = await makeNotification(receiver.id, sender.id);

    const updated = await NotifHelper.markOneAsRead(n.id, receiver.id);
    expect(updated.isRead).toBe(true);
    expect(updated.id).toBe(n.id);
  });

  test("markOneAsRead returns null for a non-owner, a deleted row, and a missing id", async () => {
    const receiver = await makeUser();
    const stranger = await makeUser();
    const sender = await makeUser();
    const n = await makeNotification(receiver.id, sender.id);
    const deleted = await makeNotification(receiver.id, sender.id, { isDeleted: true });

    expect(await NotifHelper.markOneAsRead(n.id, stranger.id)).toBeNull();
    expect(await NotifHelper.markOneAsRead(deleted.id, receiver.id)).toBeNull();
    expect(await NotifHelper.markOneAsRead(MISSING, receiver.id)).toBeNull();

    // the rejected attempts changed nothing
    expect((await prisma.notification.findUnique({ where: { id: n.id } })).isRead).toBe(false);
  });
});

describe("notificationHelpers — soft deletion", () => {
  test("softDeleteOne stamps isDeleted + deletedAt for the owner", async () => {
    const receiver = await makeUser();
    const sender = await makeUser();
    const n = await makeNotification(receiver.id, sender.id);

    const deleted = await NotifHelper.softDeleteOne(n.id, receiver.id);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedAt).toBeInstanceOf(Date);

    // and it drops out of the inbox
    expect((await NotifHelper.getInbox(receiver.id, 1, 20)).map((x) => x.id)).not.toContain(n.id);
  });

  test("softDeleteOne is idempotent-null and rejects a non-owner", async () => {
    const receiver = await makeUser();
    const stranger = await makeUser();
    const sender = await makeUser();
    const n = await makeNotification(receiver.id, sender.id);

    expect(await NotifHelper.softDeleteOne(n.id, stranger.id)).toBeNull();
    expect(await NotifHelper.softDeleteOne(n.id, receiver.id)).not.toBeNull();
    expect(await NotifHelper.softDeleteOne(n.id, receiver.id)).toBeNull(); // already deleted
    expect(await NotifHelper.softDeleteOne(MISSING, receiver.id)).toBeNull();
  });

  test("softDeleteAll clears the inbox for that user only", async () => {
    const receiver = await makeUser();
    const other = await makeUser();
    const sender = await makeUser();
    for (let i = 0; i < 3; i++) await makeNotification(receiver.id, sender.id);
    const theirs = await makeNotification(other.id, sender.id);

    const result = await NotifHelper.softDeleteAll(receiver.id);
    expect(result.count).toBe(3);

    expect(await NotifHelper.getInbox(receiver.id, 1, 20)).toEqual([]);
    expect(await NotifHelper.getUnreadCount(receiver.id)).toBe(0);
    expect((await prisma.notification.findUnique({ where: { id: theirs.id } })).isDeleted).toBe(false);

    // running again is a no-op
    expect((await NotifHelper.softDeleteAll(receiver.id)).count).toBe(0);
  });
});

// ── Phase 7B / M-1, Batch 3 — NotificationRepository boundary regression ──
// notificationHelpers needed NO conversion — bare equality only.
describe("M-1 Batch 3 — notification repository boundary", () => {
  test("neutral filters are a no-op through findManyWithRelations and updateManyWhere", async () => {
    const { notificationRepository } = await import("../../src/config/repositories.js");
    const receiver = await makeUser();
    const sender = await makeUser();
    await makeNotification(receiver.id, sender.id, { type: "like" });
    await makeNotification(receiver.id, sender.id, { type: "comment" });

    const filter = { receiverId: receiver.id, isRead: false };
    expect(await notificationRepository.count(filter))
      .toBe(await prisma.notification.count({ where: filter }));

    const viaRepo = await notificationRepository.findManyWithRelations(filter, { take: 10, skip: 0 });
    const inline  = await prisma.notification.findMany({ where: filter, take: 10, skip: 0 });
    expect(viaRepo.map((n) => n.id).sort()).toEqual(inline.map((n) => n.id).sort());

    const res = await notificationRepository.updateManyWhere(filter, { isRead: true });
    expect(res.count).toBe(2);
    expect(await prisma.notification.count({ where: { receiverId: receiver.id, isRead: false } })).toBe(0);
  });

  test("M-1 GUARANTEE: Prisma-shaped filters are rejected", async () => {
    const { notificationRepository } = await import("../../src/config/repositories.js");
    await expect(notificationRepository.count({ type: { contains: "x" } })).rejects.toThrow(/contains/);
  });
});
