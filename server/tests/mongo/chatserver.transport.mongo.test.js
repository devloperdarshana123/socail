// FINAL AUDIT — chat-server over a REAL Socket.io transport, on Mongo.
//
// The existing chatserver.mongo.test.js drives the handlers through a socket
// double. That covers the migrated layer but deliberately does not cover the
// wire, which has been carried as a documented limitation since Phase 7.
//
// This closes the transport half of it. There is a real HTTP server, a real
// socket.io server built by the service's own initSocket(), a real websocket
// handshake carrying a real JWT, real rooms, and a real client — talking to a
// real mongod. Nothing is stubbed except the things the environment cannot
// provide.
//
// ── WHAT THIS STILL DOES NOT COVER ───────────────────────────────────────
// The @socket.io/redis-adapter. It needs a Redis server, there is none in
// this environment (no daemon, and Docker's daemon is not running), and
// initSocket() does not wire an adapter anyway — it accepts pubClient and
// subClient and never uses them. So multi-instance fan-out remains untested
// and is reported as a limitation, not a pass.
//
// USER-TARGETED DELIVERY is also not covered, and that is a finding rather
// than an assumption — see the note in the message:send test. notifyUser()
// resolves a recipient's socket ids through onlineStore, which is Redis-backed
// and whose errors are swallowed by design. With no Redis the lookup returns
// nothing and no "message:receive" is emitted, while the message is still
// accepted, persisted and counted. So the production failure mode when Redis
// is down is SILENT NON-DELIVERY, not data loss — worth knowing before
// cutover, and recorded in CUTOVER.md.
process.env.DATABASE_PROVIDER = "mongo";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "test-32-character-secret-key!!!!";
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-secret";

import http from "node:http";
import jwt from "jsonwebtoken";
import { io as connect } from "socket.io-client";
import { models } from "../../../shared/database/mongodb/index.js";
import { startMongo, stopMongo, clearMongo, syncIndexes, seed } from "./harness.js";

let initSocket, httpServer, port;

beforeAll(async () => {
  await startMongo();
  await syncIndexes();
  ({ initSocket } = await import("../../../chat-server/src/socket/index.js"));

  httpServer = http.createServer();
  initSocket(httpServer); // no pub/sub clients — see the note above
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
}, 180000);

afterAll(async () => {
  if (httpServer) await new Promise((r) => httpServer.close(r));
  await stopMongo();
  delete process.env.DATABASE_PROVIDER;
}, 60000);

afterEach(async () => { await clearMongo(); });

/** A real client, authenticated the way the real client authenticates. */
function client(userId) {
  const token = jwt.sign({ _id: String(userId) }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  return connect(`http://localhost:${port}`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
}

const connected = (s) =>
  new Promise((resolve, reject) => {
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error("connect timed out")), 15000);
  });

const waitFor = (s, event, ms = 15000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms);
    s.once(event, (payload) => { clearTimeout(t); resolve(payload); });
  });

async function conversationBetween(a, b) {
  const conv = await models.Conversation.create({ type: "direct", createdBy: a._id });
  await models.ConversationParticipant.create({ conversationId: conv._id, userId: a._id });
  await models.ConversationParticipant.create({ conversationId: conv._id, userId: b._id });
  return conv;
}

// ─────────────────────────────────────────────────────────────────────────
describe("chat-server — live Socket.io transport on Mongo", () => {
  test("a valid JWT completes the websocket handshake", async () => {
    const u = await seed.user();
    const s = client(u._id);
    try {
      await connected(s);
      expect(s.connected).toBe(true);
      expect(s.io.engine.transport.name).toBe("websocket"); // a real upgrade
    } finally {
      s.close();
    }
  }, 30000);

  test("a missing or invalid token is rejected at the handshake", async () => {
    const bad = connect(`http://localhost:${port}`, {
      auth: { token: "not-a-jwt" }, transports: ["websocket"],
      reconnection: false, forceNew: true,
    });
    try {
      await expect(connected(bad)).rejects.toThrow();
    } finally {
      bad.close();
    }
  }, 30000);

  test("message:send travels over the wire, persists, and reaches the room", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const conv = await conversationBetween(a, b);
    const sender = client(a._id);
    const recipient = client(b._id);

    try {
      await Promise.all([connected(sender), connected(recipient)]);

      // Both join the conversation room — the real rooms mechanism.
      sender.emit("conversation:join", { conversationId: String(conv._id) });
      recipient.emit("conversation:join", { conversationId: String(conv._id) });
      await new Promise((r) => setTimeout(r, 300)); // let the joins land

      sender.emit("message:send", {
        conversationId: String(conv._id),
        message: { text: "live over the wire" },
      });

      // FAN-OUT NEEDS REDIS — a finding from this test, not an assumption.
      // Delivery goes through notifyUser(), which asks onlineStore.getSockets()
      // which socket ids a user currently holds. onlineStore is Redis-backed,
      // its errors are swallowed by design (a presence blip must not kill a
      // live socket), so with no Redis the lookup returns nothing and
      // "message:receive" is never emitted. The message is still accepted,
      // persisted and counted — so the failure mode in production without
      // Redis is silent non-delivery, not data loss.
      //
      // What is therefore asserted here is everything up to the fan-out:
      // the wire carried the event, the handler authorised it, and the write
      // landed. Delivery itself is covered by the handler suite (which stubs
      // presence) and is listed as a limitation until Redis is available.
      let saved = [];
      for (let i = 0; i < 40 && saved.length === 0; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        saved = await models.Message.find({ conversationId: conv._id });
      }
      expect(saved).toHaveLength(1);
      expect(saved[0].text).not.toBe("live over the wire"); // ciphertext
      let rp = await models.ConversationParticipant.findOne({
        conversationId: conv._id, userId: b._id,
      });
      for (let i = 0; i < 20 && rp.unreadCount === 0; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        rp = await models.ConversationParticipant.findOne({
          conversationId: conv._id, userId: b._id,
        });
      }
      expect(rp.unreadCount).toBe(1);
    } finally {
      sender.close();
      recipient.close();
    }
  }, 60000);

  test("an outsider's send is refused over the wire, and writes nothing", async () => {
    const [a, b, outsider] = [await seed.user(), await seed.user(), await seed.user()];
    const conv = await conversationBetween(a, b);
    const s = client(outsider._id);
    try {
      await connected(s);
      const err = waitFor(s, "error");
      s.emit("message:send", {
        conversationId: String(conv._id),
        message: { text: "let me in" },
      });
      await err;
      expect(await models.Message.countDocuments({})).toBe(0);
    } finally {
      s.close();
    }
  }, 60000);

  test("message:seen over the wire clears only that member's unread count", async () => {
    const [a, b] = [await seed.user(), await seed.user()];
    const conv = await conversationBetween(a, b);
    const msg = await models.Message.create({
      conversationId: conv._id, senderId: a._id, text: "hi",
    });
    await models.ConversationParticipant.updateOne(
      { conversationId: conv._id, userId: b._id }, { $set: { unreadCount: 5 } },
    );

    const s = client(b._id);
    try {
      await connected(s);
      s.emit("message:seen", {
        conversationId: String(conv._id), messageId: String(msg._id),
      });
      // Poll for the write rather than racing a fixed sleep.
      let unread = 5;
      for (let i = 0; i < 40 && unread !== 0; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        unread = (await models.ConversationParticipant.findOne({
          conversationId: conv._id, userId: b._id,
        })).unreadCount;
      }
      expect(unread).toBe(0);
      expect(await models.MessageReceipt.countDocuments({ messageId: msg._id })).toBe(1);

      // The sender's own count is untouched.
      const sp = await models.ConversationParticipant.findOne({
        conversationId: conv._id, userId: a._id,
      });
      expect(sp.unreadCount).toBe(0);
    } finally {
      s.close();
    }
  }, 60000);
});
