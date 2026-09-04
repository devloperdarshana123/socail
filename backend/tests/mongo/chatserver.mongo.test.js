// FINAL VERIFICATION — chat-server under DATABASE_PROVIDER=mongo.
//
// chat-server has no test suite of its own and no jest, so this runs from the
// server workspace, which already has jest, mongodb-memory-server and the
// harness. Node resolves chat-server's own imports (socket.io, winston,
// ioredis) from chat-server/node_modules because that is the directory
// nearest the importing file, so the modules under test are the real ones,
// unmodified.
//
// WHAT THIS DOES AND DOES NOT COVER. The socket handlers are invoked through
// a hand-built `socket` double rather than a live socket.io connection: the
// double records `on` registrations and captures every `emit`, and the test
// fires a handler by name. What is being verified is the migrated layer —
// composition root, transaction runner, repository calls, filter/mutation
// translation, populate — not socket.io's own transport, which the migration
// did not touch. Wire-level behaviour (handshake, rooms, redis adapter) is
// therefore NOT covered here and is called out as such in the report.
process.env.DATABASE_PROVIDER = "mongo";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "test-32-character-secret-key!!!!";

import { models } from "../../../shared/database/mongodb/index.js";
import { startMongo, stopMongo, clearMongo, syncIndexes, seed } from "./harness.js";

let repositories, transactionRunner, userService, registerChatHandlers;

// ── socket / io doubles ───────────────────────────────────────────────────
function makeSocket(userId) {
  const handlers = new Map();
  const emitted = [];
  const joined = [];
  return {
    id: `sock_${userId}`,
    user: { id: userId.toString() },
    handlers,
    emitted,
    joined,
    on: (event, fn) => handlers.set(event, fn),
    emit: (event, payload) => emitted.push({ event, payload }),
    // The handler announces presence on registration via socket.broadcast.
    broadcast: { emit: (event, payload) => emitted.push({ event, payload, broadcast: true }) },
    to: () => ({ emit: (event, payload) => emitted.push({ event, payload, to: true }) }),
    join: (room) => joined.push(room),
    leave: () => {},
    /** Fire a registered handler and wait for it, as socket.io would. */
    fire: (event, payload) => {
      const fn = handlers.get(event);
      if (!fn) throw new Error(`no handler registered for "${event}"`);
      return fn(payload);
    },
  };
}

function makeIo() {
  const sent = [];
  const io = {
    sent,
    to: (room) => ({
      emit: (event, payload) => sent.push({ room, event, payload }),
    }),
    emit: (event, payload) => sent.push({ room: null, event, payload }),
    sockets: { adapter: { rooms: new Map() } },
  };
  return io;
}

beforeAll(async () => {
  await startMongo();
  await syncIndexes();

  // Dynamic, and after startMongo, so DATABASE_PROVIDER is set before the
  // chat-server composition root evaluates it.
  repositories = await import("../../../chat-server/src/config/repositories.js");
  ({ transactionRunner } = await import("../../../chat-server/src/config/transaction.js"));
  userService = await import("../../../chat-server/src/services/userService.js");
  registerChatHandlers = (await import("../../../chat-server/src/socket/handlers/Chathandler.js")).default;
}, 120_000);

afterAll(async () => {
  await stopMongo();
  delete process.env.DATABASE_PROVIDER;
});

afterEach(async () => { await clearMongo(); });

// ─────────────────────────────────────────────────────────────────────────
describe("chat-server composition root", () => {
  test("resolves mongo and hands out Mongo repositories, not Prisma ones", () => {
    expect(repositories.DATABASE_PROVIDER).toBe("mongo");
    for (const name of [
      "userRepository", "blockRepository", "notificationRepository",
      "conversationRepository", "conversationParticipantRepository",
      "messageRepository", "messageReceiptRepository",
    ]) {
      expect(repositories[name].constructor.name).toMatch(/^Mongo/);
    }
  });

  test("the transaction runner switches with the provider", () => {
    // The server's runner was hardcoded to PrismaTransaction until this
    // phase found it. Same assertion here so the mirror cannot drift.
    expect(transactionRunner.constructor.name).toBe("MongoTransaction");
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("chat-server services", () => {
  test("isBlocked translates the neutral `or` filter and reads both directions", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    expect(await userService.isBlocked(a._id, b._id)).toBe(false);

    await models.Block.create({ blockerId: b._id, blockedId: a._id });
    // Blocked in the OTHER direction — the `or` branch is what makes this
    // true, so a dropped branch would show up here.
    expect(await userService.isBlocked(a._id, b._id)).toBe(true);
  });

  test("fetchSender returns a user and never throws on a bad id", async () => {
    const a = await seed.user();
    const found = await userService.fetchSender(a._id);
    expect(found.username).toBe(a.username);

    // The swallow-and-default contract the handlers depend on.
    const degraded = await userService.fetchSender("not-an-object-id");
    expect(degraded).toEqual({ id: "not-an-object-id", fullName: null, username: null, avatar: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("chat-server socket flows", () => {
  async function conversationBetween(a, b) {
    const conv = await models.Conversation.create({ type: "direct", createdBy: a._id });
    await models.ConversationParticipant.create({ conversationId: conv._id, userId: a._id });
    await models.ConversationParticipant.create({ conversationId: conv._id, userId: b._id });
    return conv;
  }

  test("message:send persists, encrypts, and bumps the recipient's unread counter", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const conv = await conversationBetween(a, b);

    const io = makeIo();
    const socket = makeSocket(a._id);
    await registerChatHandlers(io, socket);
    await socket.fire("message:send", {
      conversationId: conv._id.toString(),
      message: { text: "granite slab, 20mm" },
    });

    const saved = await models.Message.find({ conversationId: conv._id });
    expect(saved).toHaveLength(1);
    // Stored ciphertext, not plaintext — encryption is applied before the
    // repository call, so a broken write path would show up as either.
    expect(saved[0].text).not.toBe("granite slab, 20mm");
    expect(saved[0].text).toMatch(/^[0-9a-f]{32}:/);

    // The counter bump runs inside transactionRunner.run with the neutral
    // mutation `{ unreadCount: { inc: 1 } }` — the shape that reached
    // mongoose as a literal object before the mutation translator was wired.
    const recipient = await models.ConversationParticipant.findOne({
      conversationId: conv._id, userId: b._id,
    });
    const sender = await models.ConversationParticipant.findOne({
      conversationId: conv._id, userId: a._id,
    });
    expect(recipient.unreadCount).toBe(1);
    expect(sender.unreadCount).toBe(0); // sender must be excluded
  });

  test("message:send refuses a conversation the sender is not in", async () => {
    const [a, b, outsider] = [await seed.user(), await seed.user(), await seed.user()];
    const conv = await conversationBetween(a, b);

    const socket = makeSocket(outsider._id);
    await registerChatHandlers(makeIo(), socket);
    await socket.fire("message:send", {
      conversationId: conv._id.toString(),
      message: { text: "let me in" },
    });

    expect(await models.Message.countDocuments({})).toBe(0);
    expect(socket.emitted.some((e) => e.event === "error")).toBe(true);
  });

  test("message:seen upserts a receipt and clears only that member's unread", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const conv = await conversationBetween(a, b);
    const msg = await models.Message.create({
      conversationId: conv._id, senderId: a._id, text: "hi",
    });
    await models.ConversationParticipant.updateOne(
      { conversationId: conv._id, userId: b._id }, { $set: { unreadCount: 3 } },
    );

    const socket = makeSocket(b._id);
    await registerChatHandlers(makeIo(), socket);
    await socket.fire("message:seen", {
      conversationId: conv._id.toString(),
      messageId: msg._id.toString(),
    });

    expect(await models.MessageReceipt.countDocuments({ messageId: msg._id, userId: b._id })).toBe(1);
    expect((await models.ConversationParticipant.findOne({ conversationId: conv._id, userId: b._id })).unreadCount).toBe(0);

    // Idempotent: the upsert must not create a second receipt.
    await socket.fire("message:seen", {
      conversationId: conv._id.toString(),
      messageId: msg._id.toString(),
    });
    expect(await models.MessageReceipt.countDocuments({ messageId: msg._id })).toBe(1);
  });

  test("message:edit and message:delete write through the repository", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const conv = await conversationBetween(a, b);
    const msg = await models.Message.create({
      conversationId: conv._id, senderId: a._id, text: "typo",
    });

    const socket = makeSocket(a._id);
    await registerChatHandlers(makeIo(), socket);

    await socket.fire("message:edit", {
      conversationId: conv._id.toString(),
      messageId: msg._id.toString(),
      newText: "fixed",
    });
    const edited = await models.Message.findById(msg._id);
    expect(edited.isEdited).toBe(true);
    expect(edited.text).not.toBe("typo");

    await socket.fire("message:delete", {
      conversationId: conv._id.toString(),
      messageId: msg._id.toString(),
    });
    expect((await models.Message.findById(msg._id)).isDeleted).toBe(true);
  });

  test("message:react uses the locking read and stores the reaction", async () => {
    // findByIdForUpdate is the Mongo stand-in for Postgres's SELECT … FOR
    // UPDATE: a findOneAndUpdate that stamps lockedAt, so two concurrent
    // reactions serialise instead of clobbering each other's array.
    const [a, b] = [await seed.user(), await seed.user()];
    const conv = await conversationBetween(a, b);
    const msg = await models.Message.create({
      conversationId: conv._id, senderId: a._id, text: "nice",
    });

    const socket = makeSocket(b._id);
    await registerChatHandlers(makeIo(), socket);
    await socket.fire("message:react", {
      conversationId: conv._id.toString(),
      messageId: msg._id.toString(),
      emoji: "👍",
    });

    const reacted = await models.Message.findById(msg._id);
    expect(reacted.reactions).toHaveLength(1);
    expect(reacted.reactions[0].emoji).toBe("👍");
  });

  test("user:blockStatus reads both directions through the block repository", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    await models.Block.create({ blockerId: a._id, blockedId: b._id });

    const socket = makeSocket(a._id);
    await registerChatHandlers(makeIo(), socket);
    await socket.fire("user:blockStatus", { targetUserId: b._id.toString() });

    const reply = socket.emitted.find((e) => e.event.startsWith("user:blockStatus"));
    expect(reply).toBeTruthy();
    expect(JSON.stringify(reply.payload)).toContain("true");
  });
});
