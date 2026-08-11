// Characterization test for the `message` domain (Milestone 5G).
// messageHelpers.js already owns this domain; the controller has only 3
// direct Prisma queries (participant-exists, conversation-exists, message
// lookup). This locks down, against a real Postgres:
//   1. messageHelpers behavior behind every persistence path.
//   2. The 3 controller queries, via exact inline mirrors (extracted after).
//
// EXTERNAL SERVICES / crypto:
//   • encryptMessage/decryptMessage are LOCAL AES (crypto module) with a
//     built-in fallback key — not a network service. They round-trip
//     deterministically in tests. The 3 extracted queries involve no
//     encryption. No network is invoked anywhere here.
import { PrismaClient } from "@prisma/client";
import * as MsgHelper from "../../src/utils/messageHelpers.js";
import { decryptMessage } from "../../src/utils/encryption.js";
import {
  messageRepository,
  conversationParticipantRepository,
  conversationRepository,
} from "../../src/config/repositories.js";
import { transactionRunner } from "../../src/config/transaction.js";

const prisma = new PrismaClient();

let userA, userB, userC, conv;
const userIds = [];

async function makeUser() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({ data: { fullName: `M ${s}`, email: `m-${s}@e.com`, username: `m_${s}`, accountStatus: "active" } });
  userIds.push(u.id);
  return u;
}

beforeAll(async () => {
  userA = await makeUser();
  userB = await makeUser();
  userC = await makeUser(); // non-member
  conv = await MsgHelper.getOrCreateDM(userA.id, userB.id);
});

afterAll(async () => {
  const convIds = (await prisma.conversation.findMany({
    where: { members: { some: { userId: { in: userIds } } } }, select: { id: true },
  })).map((c) => c.id);
  await prisma.messageReceipt.deleteMany({ where: { conversationId: { in: convIds } } });
  await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } });
  await prisma.conversationParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
  await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("messageHelpers — persistence paths (characterization)", () => {
  test("getOrCreateDM creates a DM with both participants and is idempotent", async () => {
    expect(conv.participants.map((p) => p.id).sort()).toEqual([userA.id, userB.id].sort());
    const again = await MsgHelper.getOrCreateDM(userA.id, userB.id);
    expect(again.id).toBe(conv.id); // same conversation (participantsKey dedupe)
  });

  test("isParticipant is true for members, false for non-members", async () => {
    expect(await MsgHelper.isParticipant(conv.id, userA.id)).toBe(true);
    expect(await MsgHelper.isParticipant(conv.id, userC.id)).toBe(false);
  });

  test("createMessage + getMessages round-trips text through encryption", async () => {
    await MsgHelper.createMessage(conv.id, userA.id, { text: "hello world" });
    const { messages } = await MsgHelper.getMessages(conv.id, userB.id, { limit: 30 });
    const texts = messages.map((m) => m.text);
    expect(texts).toContain("hello world"); // stored encrypted, returned decrypted
  });

  test("incrementUnreadForRecipients increments the recipient (not the sender); getTotalUnread sums; markConversationRead resets", async () => {
    await MsgHelper.incrementUnreadForRecipients(conv.id, userA.id);
    const bUnread = await MsgHelper.getTotalUnread(userB.id);
    expect(bUnread).toBeGreaterThanOrEqual(1);
    expect(await MsgHelper.getTotalUnread(userA.id)).toBe(0); // sender not incremented

    await MsgHelper.markConversationRead(conv.id, userB.id);
    expect(await MsgHelper.getTotalUnread(userB.id)).toBe(0);
  });

  test("editMessage edits own message; Unauthorized for non-owner; 'Message not found' for missing", async () => {
    const msg = await MsgHelper.createMessage(conv.id, userA.id, { text: "editable" });
    const updated = await MsgHelper.editMessage(msg.id, userA.id, "edited text");
    expect(updated.isEdited).toBe(true);
    await expect(MsgHelper.editMessage(msg.id, userB.id, "hack")).rejects.toThrow("Unauthorized");
    await expect(MsgHelper.editMessage("00000000-0000-0000-0000-000000000000", userA.id, "x")).rejects.toThrow("Message not found");
  });

  test("softDeleteMessage soft-deletes own; Unauthorized for non-owner", async () => {
    const msg = await MsgHelper.createMessage(conv.id, userA.id, { text: "deletable" });
    await expect(MsgHelper.softDeleteMessage(msg.id, userB.id)).rejects.toThrow("Unauthorized");
    const deleted = await MsgHelper.softDeleteMessage(msg.id, userA.id);
    expect(deleted.isDeleted).toBe(true);
  });

  test("reactToMessage adds then removes a reaction", async () => {
    const msg = await MsgHelper.createMessage(conv.id, userA.id, { text: "reactable" });
    const added = await MsgHelper.reactToMessage(msg.id, userB.id, "❤️");
    expect(added.reactions.some((r) => r.userId === userB.id && r.emoji === "❤️")).toBe(true);
    const removed = await MsgHelper.reactToMessage(msg.id, userB.id, "");
    expect(removed.reactions.some((r) => r.userId === userB.id)).toBe(false);
  });

  test("softDeleteConversationForUser and clearChatForUser update participant state", async () => {
    const c = await MsgHelper.getOrCreateDM(userA.id, userC.id);
    await MsgHelper.clearChatForUser(c.id, userA.id);
    const afterClear = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: c.id, userId: userA.id } }, select: { clearedAt: true } });
    expect(afterClear.clearedAt).not.toBeNull();

    await MsgHelper.softDeleteConversationForUser(c.id, userA.id);
    expect(await MsgHelper.isParticipant(c.id, userA.id)).toBe(false); // isDeleted now
  });

  test("getConversationsList returns the user's active conversations", async () => {
    const { conversations } = await MsgHelper.getConversationsList(userB.id, 1, 20);
    expect(conversations.map((c) => c.id)).toContain(conv.id);
  });
});

describe("message controller direct queries — inline mirror (baseline)", () => {
  test("participant-exists: user.findUnique select id", async () => {
    const found = await prisma.user.findUnique({ where: { id: userA.id }, select: { id: true } });
    expect(Object.keys(found)).toEqual(["id"]);
    expect(await prisma.user.findUnique({ where: { id: "00000000-0000-0000-0000-000000000000" }, select: { id: true } })).toBeNull();
  });

  test("conversation-exists: conversation.findUnique select id", async () => {
    const found = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { id: true } });
    expect(Object.keys(found)).toEqual(["id"]);
    expect(await prisma.conversation.findUnique({ where: { id: "00000000-0000-0000-0000-000000000000" }, select: { id: true } })).toBeNull();
  });

  test("message lookup: message.findUnique select conversationId", async () => {
    const msg = await MsgHelper.createMessage(conv.id, userA.id, { text: "for react lookup" });
    const found = await prisma.message.findUnique({ where: { id: msg.id }, select: { conversationId: true } });
    expect(Object.keys(found)).toEqual(["conversationId"]);
    expect(found.conversationId).toBe(conv.id);
    expect(await prisma.message.findUnique({ where: { id: "00000000-0000-0000-0000-000000000000" }, select: { conversationId: true } })).toBeNull();
  });
});

// After extraction: the 3 helpers must match the inline behavior.
describe("messageHelpers — extracted guards match inline behavior", () => {
  test("findParticipantById returns { id } for existing user, null for missing", async () => {
    const found = await MsgHelper.findParticipantById(userA.id);
    expect(Object.keys(found)).toEqual(["id"]);
    expect(found.id).toBe(userA.id);
    expect(await MsgHelper.findParticipantById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("findConversationExists returns { id } for existing conversation, null for missing", async () => {
    const found = await MsgHelper.findConversationExists(conv.id);
    expect(Object.keys(found)).toEqual(["id"]);
    expect(found.id).toBe(conv.id);
    expect(await MsgHelper.findConversationExists("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getMessageConversationId returns { conversationId } for existing message, null for missing", async () => {
    const msg = await MsgHelper.createMessage(conv.id, userA.id, { text: "helper lookup" });
    const found = await MsgHelper.getMessageConversationId(msg.id);
    expect(Object.keys(found)).toEqual(["conversationId"]);
    expect(found.conversationId).toBe(conv.id);
    expect(await MsgHelper.getMessageConversationId("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5G suite above never had.
// syncLastMessage, reply previews, cursor pagination, clearedAt filtering,
// message ordering, receipt upserts, and the reactToMessage
// transaction/lock/retry path were all untested.
//
// Written and run GREEN against the original direct-Prisma implementation
// BEFORE the repository migration, so they are a true before/after net.
//
// Each block builds its own conversation so the shared `conv` fixture's
// message list and unread counters stay untouched.
// ─────────────────────────────────────────────────────────────────────────

const MISSING = "00000000-0000-0000-0000-000000000000";

async function freshDM() {
  const a = await makeUser();
  const b = await makeUser();
  const c = await MsgHelper.getOrCreateDM(a.id, b.id);
  return { a, b, c };
}

describe("messageHelpers — lastMessage preview (Phase 7A)", () => {
  test("syncLastMessage stores an encrypted, truncated preview", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "y".repeat(150) });

    await MsgHelper.syncLastMessage(c.id, {
      id: msg.id,
      text: "y".repeat(150),
      senderId: a.id,
      createdAt: msg.createdAt,
      isDeleted: false,
    });

    const row = await prisma.conversation.findUnique({ where: { id: c.id } });
    expect(row.lastMessage.messageId).toBe(msg.id);
    expect(row.lastMessage.senderId).toBe(a.id);
    expect(row.lastMessage.isDeleted).toBe(false);
    // stored ciphertext is not the plaintext, and decrypts to the 100-char slice
    expect(row.lastMessage.text).not.toBe("y".repeat(100));
    expect(decryptMessage(row.lastMessage.text)).toBe("y".repeat(100));
  });

  test("a deleted message's preview is blanked, not encrypted", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "secret" });

    await MsgHelper.syncLastMessage(c.id, {
      id: msg.id,
      text: "secret",
      senderId: a.id,
      createdAt: msg.createdAt,
      isDeleted: true,
    });

    const row = await prisma.conversation.findUnique({ where: { id: c.id } });
    expect(row.lastMessage.text).toBe(""); // empty string, no ciphertext
    expect(row.lastMessage.isDeleted).toBe(true);
  });

  test("a null message text and an absent isDeleted flag both default safely", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { image: { url: "u" } });

    await MsgHelper.syncLastMessage(c.id, {
      id: msg.id,
      text: null,
      senderId: a.id,
      createdAt: msg.createdAt,
    });

    const row = await prisma.conversation.findUnique({ where: { id: c.id } });
    expect(row.lastMessage.isDeleted).toBe(false); // ?? false
    expect(decryptMessage(row.lastMessage.text)).toBe(""); // (null ?? "") encrypted
  });
});

describe("messageHelpers — createMessage details (Phase 7A)", () => {
  test("an image-only message is typed 'image'; text wins when both are present", async () => {
    const { a, c } = await freshDM();

    const imageOnly = await MsgHelper.createMessage(c.id, a.id, { image: { url: "https://cdn/i.jpg" } });
    expect(imageOnly.type).toBe("image");
    expect(imageOnly.text).toBe("");

    const both = await MsgHelper.createMessage(c.id, a.id, {
      text: "caption",
      image: { url: "https://cdn/i.jpg" },
    });
    expect(both.type).toBe("text");

    const textOnly = await MsgHelper.createMessage(c.id, a.id, { text: "  spaced  " });
    expect(textOnly.type).toBe("text");
    expect(textOnly.image).toBeNull();
    expect(decryptMessage(textOnly.text)).toBe("spaced"); // trimmed before encrypting
  });

  test("whitespace-only text is stored as an empty string, not ciphertext", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "   " });
    expect(msg.text).toBe("");
  });

  test("replyTo embeds a preview of the parent message", async () => {
    const { a, b, c } = await freshDM();
    const parent = await MsgHelper.createMessage(c.id, b.id, { text: "z".repeat(150) });

    const reply = await MsgHelper.createMessage(c.id, a.id, { text: "replying", replyTo: parent.id });

    expect(reply.replyTo.messageId).toBe(parent.id);
    expect(reply.replyTo.senderId).toBe(b.id);
    expect(reply.replyTo.isDeleted).toBe(false);
    // PRESERVED ODDITY: the preview slices the STORED (encrypted) text, so it
    // holds a 100-char slice of ciphertext rather than readable plaintext.
    expect(reply.replyTo.text.length).toBeLessThanOrEqual(100);
    expect(reply.replyTo.text).not.toBe("z".repeat(100));
  });

  test("replying to a deleted parent blanks the preview; a missing parent yields none", async () => {
    const { a, b, c } = await freshDM();
    const parent = await MsgHelper.createMessage(c.id, b.id, { text: "gone soon" });
    await MsgHelper.softDeleteMessage(parent.id, b.id);

    const reply = await MsgHelper.createMessage(c.id, a.id, { text: "re", replyTo: parent.id });
    expect(reply.replyTo.text).toBe("");
    expect(reply.replyTo.isDeleted).toBe(true);

    const orphan = await MsgHelper.createMessage(c.id, a.id, { text: "re", replyTo: MISSING });
    expect(orphan.replyTo).toBeNull(); // no preview built
  });

  test("the created message carries its sender projection", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "hi" });
    expect(Object.keys(msg.sender).sort()).toEqual(
      ["avatar", "fullName", "id", "isVerifiedBadge", "username"].sort()
    );
  });
});

describe("messageHelpers — getMessages pagination & filtering (Phase 7A)", () => {
  test("messages come back oldest-first within a page, with hasMore/nextCursor", async () => {
    const { a, c } = await freshDM();
    const sent = [];
    for (let i = 0; i < 5; i++) {
      sent.push(await MsgHelper.createMessage(c.id, a.id, { text: `m${i}` }));
      await new Promise((r) => setTimeout(r, 5));
    }

    const page = await MsgHelper.getMessages(c.id, a.id, { limit: 3 });
    expect(page.messages.length).toBe(3);
    // newest 3 selected, then reversed → ascending within the page
    expect(page.messages.map((m) => decryptMessage(m.text))).toEqual(["m2", "m3", "m4"]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(page.messages[0].id); // oldest of the page

    const full = await MsgHelper.getMessages(c.id, a.id, { limit: 50 });
    expect(full.messages.length).toBe(5);
    expect(full.hasMore).toBe(false);
    expect(full.nextCursor).toBeNull();
  });

  test("the `before` cursor pages strictly backwards in time", async () => {
    const { a, c } = await freshDM();
    const sent = [];
    for (let i = 0; i < 5; i++) {
      sent.push(await MsgHelper.createMessage(c.id, a.id, { text: `p${i}` }));
      await new Promise((r) => setTimeout(r, 5));
    }

    const page1 = await MsgHelper.getMessages(c.id, a.id, { limit: 2 });
    const page2 = await MsgHelper.getMessages(c.id, a.id, { limit: 2, before: page1.nextCursor });

    expect(page2.messages.map((m) => decryptMessage(m.text))).toEqual(["p1", "p2"]);
    // no overlap between pages
    const ids1 = page1.messages.map((m) => m.id);
    const ids2 = page2.messages.map((m) => m.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  test("an unknown `before` cursor is ignored rather than erroring", async () => {
    const { a, c } = await freshDM();
    await MsgHelper.createMessage(c.id, a.id, { text: "only" });

    const page = await MsgHelper.getMessages(c.id, a.id, { limit: 10, before: MISSING });
    expect(page.messages.length).toBe(1); // cursor lookup missed → no extra filter
  });

  test("clearChatForUser hides earlier messages from that user only", async () => {
    const { a, b, c } = await freshDM();
    await MsgHelper.createMessage(c.id, a.id, { text: "before clear" });
    await new Promise((r) => setTimeout(r, 10));

    await MsgHelper.clearChatForUser(c.id, a.id);
    await new Promise((r) => setTimeout(r, 10));
    await MsgHelper.createMessage(c.id, b.id, { text: "after clear" });

    const forA = await MsgHelper.getMessages(c.id, a.id, { limit: 50 });
    expect(forA.messages.map((m) => decryptMessage(m.text))).toEqual(["after clear"]);

    const forB = await MsgHelper.getMessages(c.id, b.id, { limit: 50 });
    expect(forB.messages.map((m) => decryptMessage(m.text))).toEqual(["before clear", "after clear"]);
  });

  test("soft-deleted messages are excluded from the list", async () => {
    const { a, c } = await freshDM();
    const keep = await MsgHelper.createMessage(c.id, a.id, { text: "keep" });
    const drop = await MsgHelper.createMessage(c.id, a.id, { text: "drop" });
    await MsgHelper.softDeleteMessage(drop.id, a.id);

    const page = await MsgHelper.getMessages(c.id, a.id, { limit: 50 });
    expect(page.messages.map((m) => m.id)).toEqual([keep.id]);
  });

  test("a non-member reading gets the unfiltered list (no clearedAt row)", async () => {
    // PRESERVED BEHAVIOR: getMessages does not itself authorize — the
    // participant check lives in the controller. A missing participant row
    // simply means no clearedAt filter is applied.
    const { a, c } = await freshDM();
    await MsgHelper.createMessage(c.id, a.id, { text: "visible" });

    const outsider = await makeUser();
    const page = await MsgHelper.getMessages(c.id, outsider.id, { limit: 50 });
    expect(page.messages.length).toBe(1);
  });
});

describe("messageHelpers — conversations list & unread (Phase 7A)", () => {
  test("the list carries per-user unreadCount and a participants array", async () => {
    const { a, b, c } = await freshDM();
    await MsgHelper.createMessage(c.id, b.id, { text: "ping" });
    await MsgHelper.incrementUnreadForRecipients(c.id, b.id);

    const { conversations } = await MsgHelper.getConversationsList(a.id, 1, 20);
    const mine = conversations.find((x) => x.id === c.id);

    expect(mine.unreadCount).toBe(1);
    expect(mine.participants.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
    expect(Object.keys(mine.participants[0]).sort()).toEqual(
      ["accountStatus", "avatar", "fullName", "id", "isVerifiedBadge", "username"].sort()
    );

    // the sender sees zero unread for the same conversation
    const forB = await MsgHelper.getConversationsList(b.id, 1, 20);
    expect(forB.conversations.find((x) => x.id === c.id).unreadCount).toBe(0);
  });

  test("pagination reports hasMore and respects page size", async () => {
    const owner = await makeUser();
    for (let i = 0; i < 3; i++) {
      const other = await makeUser();
      await MsgHelper.getOrCreateDM(owner.id, other.id);
    }

    const page1 = await MsgHelper.getConversationsList(owner.id, 1, 2);
    expect(page1.conversations.length).toBe(2);
    expect(page1.hasMore).toBe(true);

    const page2 = await MsgHelper.getConversationsList(owner.id, 2, 2);
    expect(page2.conversations.length).toBe(1);
    expect(page2.hasMore).toBe(false);
  });

  test("a conversation soft-deleted for the user drops out of their list", async () => {
    const { a, b, c } = await freshDM();
    expect((await MsgHelper.getConversationsList(a.id, 1, 20)).conversations.map((x) => x.id)).toContain(c.id);

    await MsgHelper.softDeleteConversationForUser(c.id, a.id);

    expect((await MsgHelper.getConversationsList(a.id, 1, 20)).conversations.map((x) => x.id)).not.toContain(c.id);
    // still visible to the other participant
    expect((await MsgHelper.getConversationsList(b.id, 1, 20)).conversations.map((x) => x.id)).toContain(c.id);
  });

  test("markConversationRead resets the counter and writes seen receipts", async () => {
    const { a, b, c } = await freshDM();
    const m1 = await MsgHelper.createMessage(c.id, b.id, { text: "one" });
    const m2 = await MsgHelper.createMessage(c.id, b.id, { text: "two" });
    await MsgHelper.incrementUnreadForRecipients(c.id, b.id);
    await MsgHelper.incrementUnreadForRecipients(c.id, b.id);

    expect(await MsgHelper.getTotalUnread(a.id)).toBeGreaterThanOrEqual(2);

    await MsgHelper.markConversationRead(c.id, a.id);

    const member = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: c.id, userId: a.id } },
    });
    expect(member.unreadCount).toBe(0);
    expect(member.lastSeenAt).toBeInstanceOf(Date);

    const receipts = await prisma.messageReceipt.findMany({
      where: { conversationId: c.id, userId: a.id },
    });
    expect(receipts.map((r) => r.messageId).sort()).toEqual([m1.id, m2.id].sort());
    expect(receipts.every((r) => r.seenAt instanceof Date)).toBe(true);
  });

  test("markConversationRead is idempotent — the receipt upsert updates in place", async () => {
    const { a, b, c } = await freshDM();
    await MsgHelper.createMessage(c.id, b.id, { text: "once" });

    await MsgHelper.markConversationRead(c.id, a.id);
    const first = await prisma.messageReceipt.findMany({ where: { conversationId: c.id, userId: a.id } });
    expect(first.length).toBe(1);

    await MsgHelper.markConversationRead(c.id, a.id);
    const second = await prisma.messageReceipt.findMany({ where: { conversationId: c.id, userId: a.id } });
    expect(second.length).toBe(1); // upsert, not a duplicate insert
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].seenAt.getTime()).toBeGreaterThanOrEqual(first[0].seenAt.getTime());
  });

  test("getTotalUnread sums across conversations and returns 0 for none", async () => {
    const owner = await makeUser();
    expect(await MsgHelper.getTotalUnread(owner.id)).toBe(0); // _sum of nothing → ?? 0

    for (let i = 0; i < 2; i++) {
      const other = await makeUser();
      const c = await MsgHelper.getOrCreateDM(owner.id, other.id);
      await MsgHelper.createMessage(c.id, other.id, { text: "hi" });
      await MsgHelper.incrementUnreadForRecipients(c.id, other.id);
    }

    expect(await MsgHelper.getTotalUnread(owner.id)).toBe(2);
  });
});

describe("messageHelpers — edit & delete guards (Phase 7A)", () => {
  test("editMessage rejects editing a deleted message and stamps isEdited", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "orig" });

    const edited = await MsgHelper.editMessage(msg.id, a.id, "  updated  ");
    expect(decryptMessage(edited.text)).toBe("updated"); // trimmed + re-encrypted
    expect(edited.isEdited).toBe(true);
    expect(edited.editedAt).toBeInstanceOf(Date);

    await MsgHelper.softDeleteMessage(msg.id, a.id);
    await expect(MsgHelper.editMessage(msg.id, a.id, "again")).rejects.toThrow(
      /Cannot edit a deleted message/
    );
  });

  test("softDeleteMessage clears content and rejects a repeat delete", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, {
      text: "bye",
      image: { url: "https://cdn/x.jpg" },
    });

    const deleted = await MsgHelper.softDeleteMessage(msg.id, a.id);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.text).toBe("");
    expect(deleted.image).toBeNull();
    expect(deleted.reactions).toEqual([]);
    expect(deleted.deletedAt).toBeInstanceOf(Date);

    await expect(MsgHelper.softDeleteMessage(msg.id, a.id)).rejects.toThrow(/already deleted/);
    await expect(MsgHelper.softDeleteMessage(MISSING, a.id)).rejects.toThrow(/Message not found/);
  });
});

describe("messageHelpers — reactToMessage locking & retry (Phase 7A)", () => {
  test("reactions are keyed per user: a second user adds, the first replaces", async () => {
    const { a, b, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "react to me" });

    await MsgHelper.reactToMessage(msg.id, a.id, "❤️");
    const twoUsers = await MsgHelper.reactToMessage(msg.id, b.id, "🔥");
    expect(twoUsers.reactions.length).toBe(2);
    expect(twoUsers.reactions.map((r) => r.userId).sort()).toEqual([a.id, b.id].sort());

    // same user reacting again REPLACES rather than appends
    const replaced = await MsgHelper.reactToMessage(msg.id, a.id, "😂");
    expect(replaced.reactions.length).toBe(2);
    expect(replaced.reactions.find((r) => r.userId === a.id).emoji).toBe("😂");

    // each reaction records when it happened
    expect(replaced.reactions.every((r) => r.reactedAt)).toBe(true);
  });

  test("an empty or whitespace emoji removes that user's reaction", async () => {
    const { a, b, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "r" });

    await MsgHelper.reactToMessage(msg.id, a.id, "❤️");
    await MsgHelper.reactToMessage(msg.id, b.id, "🔥");

    const afterBlank = await MsgHelper.reactToMessage(msg.id, a.id, "   ");
    expect(afterBlank.reactions.map((r) => r.userId)).toEqual([b.id]);

    const afterNull = await MsgHelper.reactToMessage(msg.id, b.id, null);
    expect(afterNull.reactions).toEqual([]);
  });

  test("guard errors are thrown immediately and are NOT retried", async () => {
    // The retry loop rethrows these two messages without re-attempting, so a
    // missing/deleted message fails fast rather than after 3 attempts.
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "doomed" });
    await MsgHelper.softDeleteMessage(msg.id, a.id);

    const startDeleted = Date.now();
    await expect(MsgHelper.reactToMessage(msg.id, a.id, "❤️")).rejects.toThrow(
      /Cannot react to a deleted message/
    );
    // a retried path would sleep 50ms + 100ms before giving up
    expect(Date.now() - startDeleted).toBeLessThan(150);

    const startMissing = Date.now();
    await expect(MsgHelper.reactToMessage(MISSING, a.id, "❤️")).rejects.toThrow(/Message not found/);
    expect(Date.now() - startMissing).toBeLessThan(150);
  });

  test("concurrent reactions from different users all survive (row lock serializes them)", async () => {
    // This is what the SELECT ... FOR UPDATE exists for: without the lock,
    // concurrent read-modify-write cycles on the reactions array would drop
    // updates. All five must be present afterwards.
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "stampede" });

    const reactors = [];
    for (let i = 0; i < 5; i++) reactors.push(await makeUser());

    await Promise.all(
      reactors.map((u, i) => MsgHelper.reactToMessage(msg.id, u.id, ["❤️", "🔥", "😂", "😮", "😢"][i]))
    );

    const row = await prisma.message.findUnique({ where: { id: msg.id }, select: { reactions: true } });
    expect(row.reactions.length).toBe(5);
    expect(row.reactions.map((r) => r.userId).sort()).toEqual(reactors.map((u) => u.id).sort());
  });

  test("the same user reacting concurrently still leaves exactly one reaction", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "self stampede" });
    const reactor = await makeUser();

    await Promise.all(
      ["❤️", "🔥", "😂"].map((e) => MsgHelper.reactToMessage(msg.id, reactor.id, e))
    );

    const row = await prisma.message.findUnique({ where: { id: msg.id }, select: { reactions: true } });
    expect(row.reactions.length).toBe(1);
    expect(row.reactions[0].userId).toBe(reactor.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY HAZARD REGRESSIONS (Phase 7A Milestone 8)
//
// The mechanisms this domain's correctness rests on, verified explicitly
// rather than inferred — this is the only helper in Phase 7A whose raw SQL
// is load-bearing (a real row lock) rather than a convenience.
// ─────────────────────────────────────────────────────────────────────────
describe("MessageRepository.findByIdForUpdate — row lock (Phase 7A)", () => {
  test("returns the raw result-set SHAPE the caller's empty-check depends on", async () => {
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "shape" });

    const rows = await transactionRunner.run(async (tx) =>
      messageRepository.findByIdForUpdate(msg.id, { tx })
    );

    // an ARRAY, not a single row — reactToMessage tests msg.length === 0
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["id", "isDeleted", "reactions"].sort());
    expect(rows[0].id).toBe(msg.id);

    // a missing id yields an EMPTY ARRAY rather than null or a throw
    const none = await transactionRunner.run(async (tx) =>
      messageRepository.findByIdForUpdate(MISSING, { tx })
    );
    expect(none).toEqual([]);
  });

  test("the lock actually blocks a competing writer until the holder commits", async () => {
    // Proves the FOR UPDATE clause survived the move into the repository. A
    // second transaction attempting to lock the same row must WAIT for the
    // first to finish, so the recorded completion order is deterministic.
    const { a, c } = await freshDM();
    const msg = await MsgHelper.createMessage(c.id, a.id, { text: "locked" });

    const order = [];
    let releaseFirst;
    const firstHolding = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const holder = transactionRunner.run(async (tx) => {
      await messageRepository.findByIdForUpdate(msg.id, { tx });
      order.push("first-acquired");
      await firstHolding; // hold the lock open
      order.push("first-releasing");
    });

    // give the holder time to take the lock
    await new Promise((r) => setTimeout(r, 100));

    const waiter = transactionRunner.run(async (tx) => {
      await messageRepository.findByIdForUpdate(msg.id, { tx });
      order.push("second-acquired");
    });

    // the waiter must not have acquired yet
    await new Promise((r) => setTimeout(r, 100));
    expect(order).toEqual(["first-acquired"]);

    releaseFirst();
    await Promise.all([holder, waiter]);

    expect(order).toEqual(["first-acquired", "first-releasing", "second-acquired"]);
  });

  test("guard errors thrown inside the transaction keep their message across the boundary", async () => {
    // reactToMessage's retry loop compares err.message to decide whether to
    // fail fast; TransactionError must preserve it.
    const err = await transactionRunner
      .run(async () => {
        throw new Error("Message not found");
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    expect(err.message).toBe("Message not found");
  });
});

describe("Messaging repositories — unbounded reads vs findMany cap (Phase 7A hazard)", () => {
  const CAP = 20; // toPrismaPagination()'s default limit

  test("markConversationRead writes a receipt for EVERY message, past the cap", async () => {
    const { a, b, c } = await freshDM();
    const total = CAP + 3;
    for (let i = 0; i < total; i++) {
      await MsgHelper.createMessage(c.id, b.id, { text: `bulk${i}` });
    }

    const all = await messageRepository.findAllByConversationId(c.id, { select: { id: true } });
    expect(all.length).toBe(total);
    expect(all.length).toBeGreaterThan(CAP);

    // NOTE — MessageRepository.findMany is one of the repositories that does
    // NOT route through toPrismaPagination(): it forwards pagination.skip /
    // pagination.take raw, so it is uncapped by default. The layer therefore
    // has TWO pagination contracts and which one applies cannot be inferred
    // without reading the specific repository. Pinned here so that stays
    // visible.
    const viaFindMany = await messageRepository.findMany({ conversationId: c.id });
    expect(viaFindMany.length).toBe(total); // uncapped, unlike SocialPost/User/Follow

    await MsgHelper.markConversationRead(c.id, a.id);
    const receipts = await prisma.messageReceipt.count({ where: { conversationId: c.id, userId: a.id } });
    expect(receipts).toBe(total); // no message left unreceipted
  });

  test("getConversationsList sees every membership row, past the cap", async () => {
    const owner = await makeUser();
    const total = CAP + 3;
    for (let i = 0; i < total; i++) {
      const other = await makeUser();
      await MsgHelper.getOrCreateDM(owner.id, other.id);
    }

    const memberships = await conversationParticipantRepository.findAllActiveByUserId(owner.id, {
      select: { conversationId: true, unreadCount: true },
    });
    expect(memberships.length).toBe(total);
    expect(memberships.length).toBeGreaterThan(CAP);

    // and the helper can therefore page beyond 20 conversations
    const page = await MsgHelper.getConversationsList(owner.id, 1, total + 5);
    expect(page.conversations.length).toBe(total);
    expect(page.hasMore).toBe(false);
  });

  test("findUsersByIds validates a batch larger than the cap", async () => {
    const users = [];
    for (let i = 0; i < CAP + 3; i++) users.push(await makeUser());
    const ids = users.map((u) => u.id);

    const found = await MsgHelper.findUsersByIds(ids);
    expect(found.length).toBe(ids.length);
    expect(found.length).toBeGreaterThan(CAP);
    // a bad id in the batch is still detectable
    const partial = await MsgHelper.findUsersByIds([...ids, MISSING]);
    expect(partial.length).toBe(ids.length);
  });
});

describe("Messaging repositories — upsert & nested-write semantics (Phase 7A)", () => {
  test("participant upsert re-activates rather than duplicating", async () => {
    const { a, b, c } = await freshDM();
    const before = await prisma.conversationParticipant.count({ where: { conversationId: c.id } });

    await MsgHelper.softDeleteGroupMember(c.id, a.id);
    expect(
      (await prisma.conversationParticipant.findFirst({ where: { conversationId: c.id, userId: a.id } }))
        .isDeleted
    ).toBe(true);

    await MsgHelper.upsertGroupMember(c.id, a.id);

    const after = await prisma.conversationParticipant.count({ where: { conversationId: c.id } });
    expect(after).toBe(before); // no duplicate row
    expect(
      (await prisma.conversationParticipant.findFirst({ where: { conversationId: c.id, userId: a.id } }))
        .isDeleted
    ).toBe(false);
  });

  test("nested member creation stays atomic — a bad participant id creates no conversation", async () => {
    const admin = await makeUser();
    const before = await prisma.conversation.count();

    await expect(
      MsgHelper.createGroupConversation({
        groupName: "Doomed",
        adminId: admin.id,
        avatarUrl: null,
        allParticipants: [admin.id, MISSING], // FK violation on the nested create
      })
    ).rejects.toThrow();

    // the parent row was rolled back with its nested children
    expect(await prisma.conversation.count()).toBe(before);
  });

  test("conversation create/update forward `data` verbatim, so nested writes still work", async () => {
    const admin = await makeUser();
    const member = await makeUser();

    const group = await conversationRepository.create(
      {
        isGroup: true,
        groupName: "Verbatim",
        groupAdmin: { link: admin.id },
        members: { create: [{ userId: admin.id }, { userId: member.id }] },
      },
      { include: includeMembersForTest }
    );

    // `groupAdmin` is a RELATION (scalar FK `groupAdminId`), so an `include`
    // that doesn't name it returns the FK only — which is what the nested
    // `connect` actually writes.
    expect(group.groupAdminId).toBe(admin.id);
    expect(group.members.length).toBe(2);

    const reassigned = await conversationRepository.update(
      group.id,
      { groupAdmin: { link: member.id } },
      { include: includeMembersForTest }
    );
    expect(reassigned.groupAdminId).toBe(member.id); // connect resolved
    expect(reassigned.members.length).toBe(2);

    // and selecting the relation itself hydrates the User, as the helper's
    // admin-guard lookups rely on
    const withAdmin = await conversationRepository.findById(group.id, {
      select: { id: true, isGroup: true, groupAdmin: true },
    });
    expect(withAdmin.groupAdmin.id).toBe(member.id);
  });
});

// Mirror of the helper's private includeMembers, for the repository-level
// assertions above.
const includeMembersForTest = {
  members: {
    where: { isDeleted: false },
    include: { user: { select: { id: true, username: true } } },
  },
};
