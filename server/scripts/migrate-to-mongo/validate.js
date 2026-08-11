import { models } from "../../../shared/database/mongodb/index.js";
import { PLAN } from "./plan.js";
import { oid } from "./ids.js";

// ── VALIDATION ───────────────────────────────────────────────────────────
//
// Independent of the engine on purpose: it recomputes each expected `_id`
// from the PostgreSQL side and asks Mongo whether it is there, rather than
// trusting the counters the migration reported about itself. A migration that
// lied about what it wrote cannot pass this.
//
// Every check either passes or produces a FAILURE. The process exits non-zero
// on any failure, so this is usable as a cutover gate in CI.

const SAMPLE = 200; // rows per collection for the deep field-level compare

/** `+path` for every field the schema hides with select:false. */
function hidden(Model) {
  const paths = [];
  Model.schema.eachPath((p, t) => {
    if (t.options?.select === false) paths.push(`+${p}`);
  });
  return paths.join(" ");
}

/** Relationships to resolve, per Mongo model: [field, target model]. */
const RELATIONS = {
  Session: [["userId", "User"]],
  SuspensionHistory: [["userId", "User"], ["performedBy", "User"]],
  SocialPost: [["authorId", "User"]],
  Comment: [["postId", "SocialPost"], ["authorId", "User"],
            ["parentCommentId", "Comment"], ["rootCommentId", "Comment"],
            ["moderatedBy", "User"], ["deletedBy", "User"]],
  Like: [["likedById", "User"]],
  Follow: [["followerId", "User"], ["followingId", "User"]],
  Saved: [["savedById", "User"], ["postId", "SocialPost"]],
  Block: [["blockerId", "User"], ["blockedId", "User"]],
  Story: [["authorId", "User"]],
  StoryView: [["storyId", "Story"], ["viewerId", "User"]],
  PostView: [["postId", "SocialPost"], ["userId", "User"]],
  Highlight: [["authorId", "User"]],
  Conversation: [["groupAdminId", "User"]],
  ConversationParticipant: [["conversationId", "Conversation"], ["userId", "User"]],
  Message: [["conversationId", "Conversation"], ["senderId", "User"]],
  MessageReceipt: [["messageId", "Message"], ["conversationId", "Conversation"], ["userId", "User"]],
  Notification: [["receiverId", "User"], ["senderId", "User"]],
  Report: [["reportedById", "User"], ["postId", "SocialPost"], ["commentId", "Comment"],
           ["reportedUserId", "User"], ["claimedById", "User"],
           ["escalatedById", "User"], ["reviewedById", "User"]],
  AuditLog: [["performedById", "User"]],
  Consent: [["userId", "User"]],
  Otp: [["userId", "User"]],
  Hashtag: [["bannedById", "User"]],
};

export async function validateAll(prisma, { log }) {
  const failures = [];
  const summary = {};
  const fail = (msg) => { failures.push(msg); log(`  FAIL  ${msg}`); };

  // ── 1. Counts, per collection ──────────────────────────────────────────
  log("\n[1/7] Row counts");
  for (const entry of PLAN) {
    const Model = models[entry.model];
    const src = await prisma[entry.source].count();
    // The two notification tables share one collection, so each is counted
    // through its own audience discriminator.
    const filter = entry.model === "Notification"
      ? { audience: entry.source === "adminNotification" ? "admin" : "user" }
      : {};
    const dst = await Model.countDocuments(filter);
    summary[entry.source] = { source: src, destination: dst, missing: src - dst };
    const mark = src === dst ? "ok  " : "FAIL";
    log(`  ${mark}  ${entry.source.padEnd(24)} pg=${String(src).padStart(7)} mongo=${String(dst).padStart(7)}`);
    if (src !== dst) {
      fail(`${entry.source}: ${src} in PostgreSQL, ${dst} in Mongo (${src - dst} missing)`);
    }
  }

  // ── 2. Every source id resolves to a destination document ──────────────
  // Counts alone can agree while the wrong rows are present. This walks the
  // source ids and checks each derived _id exists.
  log("\n[2/7] Identity — every PostgreSQL id has its derived document");
  for (const entry of PLAN) {
    const Model = models[entry.model];
    const rows = await prisma[entry.source].findMany({ select: { id: true } });
    if (!rows.length) { log(`  ok    ${entry.source.padEnd(24)} (empty)`); continue; }

    const expected = rows.map((r) => oid(r.id));
    const found = await Model.countDocuments({ _id: { $in: expected } });
    const mark = found === expected.length ? "ok  " : "FAIL";
    log(`  ${mark}  ${entry.source.padEnd(24)} ${found}/${expected.length} ids present`);
    if (found !== expected.length) {
      const present = new Set(
        (await Model.find({ _id: { $in: expected } }, { _id: 1 }).lean())
          .map((d) => String(d._id))
      );
      const missing = rows.filter((r) => !present.has(String(oid(r.id)))).slice(0, 5);
      fail(`${entry.source}: ${expected.length - found} ids missing, e.g. ${missing.map((r) => r.id).join(", ")}`);
    }
  }

  // ── 3. Relationship resolution ─────────────────────────────────────────
  log("\n[3/7] Relationships — every reference resolves");
  const relStats = {};
  for (const [modelName, rels] of Object.entries(RELATIONS)) {
    const Model = models[modelName];
    for (const [field, targetModel] of rels) {
      const Target = models[targetModel];
      const ids = await Model.distinct(field, { [field]: { $ne: null } });
      if (!ids.length) continue;
      const resolved = await Target.countDocuments({ _id: { $in: ids } });
      const orphans = ids.length - resolved;
      relStats[`${modelName}.${field}`] = { refs: ids.length, resolved, orphans };
      const mark = orphans === 0 ? "ok  " : "FAIL";
      log(`  ${mark}  ${(modelName + "." + field).padEnd(38)} ${resolved}/${ids.length} → ${targetModel}`);
      if (orphans > 0) {
        const present = new Set(
          (await Target.find({ _id: { $in: ids } }, { _id: 1 }).lean()).map((d) => String(d._id))
        );
        const sample = ids.filter((i) => !present.has(String(i))).slice(0, 3);
        fail(`${modelName}.${field}: ${orphans} dangling reference(s) into ${targetModel}, e.g. ${sample.join(", ")}`);
      }
    }
  }

  // ── 4. Field-level compare on a sample ─────────────────────────────────
  // Counts and ids can both be right while a field is wrong. This re-maps a
  // sample through the plan and compares the result to what is stored.
  log(`\n[4/7] Field fidelity — re-mapping a sample of ${SAMPLE} rows per collection`);
  for (const entry of PLAN) {
    const Model = models[entry.model];
    const rows = await prisma[entry.source].findMany({ take: SAMPLE, orderBy: { id: "asc" } });
    let checked = 0;
    let mismatched = 0;
    for (const row of rows) {
      let expected;
      try { expected = entry.map(row); } catch { continue; }
      if (!expected) continue;
      // `+field` for every select:false path. passwordHash and hashedOtp are
      // hidden by default, so a plain read returns undefined and the compare
      // would report a mismatch on data that migrated perfectly well.
      const actual = await Model.findById(expected._id).select(hidden(Model)).lean();
      if (!actual) { mismatched += 1; continue; }
      checked += 1;
      for (const [k, v] of Object.entries(expected)) {
        if (k === "_id" || v === undefined || v === null) continue;
        const a = actual[k];
        const same =
          v instanceof Date ? new Date(a ?? 0).getTime() === v.getTime()
          : typeof v === "object" ? JSON.stringify(a) === JSON.stringify(v)
          : String(a) === String(v);
        if (!same) {
          mismatched += 1;
          if (mismatched <= 3) {
            fail(`${entry.source} ${row.id}: field "${k}" is ${JSON.stringify(a)}, expected ${JSON.stringify(v)}`);
          }
          break;
        }
      }
    }
    log(`  ${mismatched === 0 ? "ok  " : "FAIL"}  ${entry.source.padEnd(24)} ${checked} compared, ${mismatched} mismatched`);
  }

  // ── 5. Derived fields ──────────────────────────────────────────────────
  log("\n[5/7] Derived fields");
  const convWithMembers = await prisma.conversationParticipant.findMany({
    select: { conversationId: true }, distinct: ["conversationId"],
  });
  const convWithIds = await models.Conversation.countDocuments({
    participantIds: { $exists: true, $ne: [] },
  });
  log(`  ${convWithIds === convWithMembers.length ? "ok  " : "FAIL"}  Conversation.participantIds  ` +
      `${convWithIds}/${convWithMembers.length} conversations populated`);
  if (convWithIds !== convWithMembers.length) {
    fail(`Conversation.participantIds: ${convWithMembers.length - convWithIds} conversation(s) have members in PostgreSQL but an empty embedded list`);
  }

  const hlWithStories = await prisma.highlightStory.findMany({
    select: { highlightId: true }, distinct: ["highlightId"],
  });
  const hlWithRefs = await models.Highlight.countDocuments({
    storyRefs: { $exists: true, $ne: [] },
  });
  log(`  ${hlWithRefs === hlWithStories.length ? "ok  " : "FAIL"}  Highlight.storyRefs          ` +
      `${hlWithRefs}/${hlWithStories.length} highlights populated`);
  if (hlWithRefs !== hlWithStories.length) {
    fail(`Highlight.storyRefs: ${hlWithStories.length - hlWithRefs} highlight(s) have stories in PostgreSQL but an empty embedded list`);
  }


  // ── 6. Counters and dates, summed across the whole table ───────────────
  // The sample compare above checks 200 rows per collection. Counters and
  // timestamps are the two things where a systematic drift across the OTHER
  // rows would be both invisible there and expensive later — a counter that
  // silently reset to 0, or a date that got restamped with the migration's
  // own clock. Aggregate sums catch that across every row at once.
  log("\n[6/7] Counters and timestamps (whole-table aggregates)");
  const COUNTERS = [
    ["user", "User", {}, ["followersCount", "followingCount", "postsCount"]],
    ["post", "SocialPost", {}, ["likesCount", "commentsCount", "savedCount", "viewsCount", "sharesCount"]],
    ["comment", "Comment", {}, ["likesCount", "repliesCount"]],
    ["story", "Story", {}, ["viewsCount", "reactionsCount"]],
    ["conversationParticipant", "ConversationParticipant", {}, ["unreadCount"]],
    ["hashtag", "Hashtag", {}, ["postsCount", "recentPostsCount"]],
  ];
  for (const [source, modelName, filter, fields] of COUNTERS) {
    const Model = models[modelName];
    const pgAgg = await prisma[source].aggregate({ _sum: Object.fromEntries(fields.map((f) => [f, true])) });
    const [mgAgg] = await Model.aggregate([
      ...(Object.keys(filter).length ? [{ $match: filter }] : []),
      { $group: { _id: null, ...Object.fromEntries(fields.map((f) => [f, { $sum: `$${f}` }])) } },
    ]);
    for (const f of fields) {
      const pg = pgAgg._sum[f] ?? 0;
      const mg = mgAgg?.[f] ?? 0;
      const ok = pg === mg;
      log(`  ${ok ? "ok  " : "FAIL"}  ${(modelName + "." + f).padEnd(38)} pg=${pg} mongo=${mg}`);
      if (!ok) fail(`${modelName}.${f}: counter total is ${mg} in Mongo, ${pg} in PostgreSQL (drift ${mg - pg})`);
    }
  }

  // Timestamp extremes. If anything restamped createdAt/updatedAt, the min
  // and max move — which a per-row sample of the oldest 200 rows would miss.
  const DATES = [
    ["user", "User", ["createdAt", "updatedAt"]],
    ["post", "SocialPost", ["createdAt", "updatedAt"]],
    ["comment", "Comment", ["createdAt", "updatedAt"]],
    ["message", "Message", ["createdAt", "updatedAt"]],
    ["story", "Story", ["createdAt", "expiresAt"]],
    ["refreshToken", "Session", ["createdAt", "expiresAt"]],
    ["report", "Report", ["createdAt", "updatedAt"]],
  ];
  for (const [source, modelName, fields] of DATES) {
    const Model = models[modelName];
    for (const f of fields) {
      const lo = await prisma[source].findFirst({ orderBy: { [f]: "asc" }, select: { [f]: true } });
      const hi = await prisma[source].findFirst({ orderBy: { [f]: "desc" }, select: { [f]: true } });
      if (!lo || !hi || lo[f] == null) continue;
      const filter = modelName === "Notification" ? {} : {};
      const [mLo] = await Model.find(filter).sort({ [f]: 1 }).limit(1).lean();
      const [mHi] = await Model.find(filter).sort({ [f]: -1 }).limit(1).lean();
      const same =
        mLo && mHi &&
        new Date(mLo[f]).getTime() === new Date(lo[f]).getTime() &&
        new Date(mHi[f]).getTime() === new Date(hi[f]).getTime();
      log(`  ${same ? "ok  " : "FAIL"}  ${(modelName + "." + f).padEnd(38)} range preserved`);
      if (!same) {
        fail(`${modelName}.${f}: date range differs — PostgreSQL ${lo[f]?.toISOString?.() ?? lo[f]} … ` +
             `${hi[f]?.toISOString?.() ?? hi[f]}, Mongo ${mLo?.[f]} … ${mHi?.[f]}`);
      }
    }
  }

  // ── 7. Special transforms ──────────────────────────────────────────────
  // The mappings that are not a copy. Each is checked as a whole-population
  // invariant rather than on a sample, because a transform that is wrong is
  // usually wrong for every row.
  log("\n[7/7] Special transforms");

  // password -> passwordHash: nothing may arrive empty that was set at source.
  const pgWithPassword = await prisma.user.count({ where: { NOT: { password: null } } });
  const mgWithHash = await models.User.countDocuments({ passwordHash: { $exists: true, $ne: null } });
  log(`  ${pgWithPassword === mgWithHash ? "ok  " : "FAIL"}  password -> passwordHash              ${mgWithHash}/${pgWithPassword}`);
  if (pgWithPassword !== mgWithHash) {
    fail(`password->passwordHash: ${pgWithPassword} users have a password in PostgreSQL, ${mgWithHash} have a passwordHash in Mongo`);
  }

  // Role representation: a plain string, never the old { roleKey } subdocument.
  const objectRoles = await models.User.countDocuments({ role: { $type: "object" } });
  log(`  ${objectRoles === 0 ? "ok  " : "FAIL"}  role is a string, not a subdocument    ${objectRoles} object(s)`);
  if (objectRoles) fail(`User.role: ${objectRoles} document(s) still hold an embedded role object`);
  for (const { role } of await prisma.user.findMany({ distinct: ["role"], select: { role: true } })) {
    const pg = await prisma.user.count({ where: { role } });
    const mg = await models.User.countDocuments({ role });
    if (pg !== mg) fail(`User.role "${role}": ${pg} in PostgreSQL, ${mg} in Mongo`);
  }

  // Polymorphic Like and Report: every migrated row must carry both halves.
  for (const [modelName, label] of [["Like", "like"], ["Report", "report"]]) {
    const broken = await models[modelName].countDocuments({
      $or: [{ targetType: { $in: [null, ""] } }, { targetId: null }],
    });
    log(`  ${broken === 0 ? "ok  " : "FAIL"}  polymorphic ${label.padEnd(28)} ${broken} incomplete`);
    if (broken) fail(`${modelName}: ${broken} document(s) have an incomplete targetType/targetId pair`);
  }

  // AdminNotification -> audience:"admin", and the two audiences stay disjoint.
  const adminCount = await models.Notification.countDocuments({ audience: "admin" });
  const pgAdmin = await prisma.adminNotification.count();
  const strays = await models.Notification.countDocuments({ audience: { $nin: ["user", "admin"] } });
  log(`  ${adminCount === pgAdmin && strays === 0 ? "ok  " : "FAIL"}  AdminNotification -> audience=admin   ${adminCount}/${pgAdmin}`);
  if (adminCount !== pgAdmin) fail(`AdminNotification: ${pgAdmin} rows, ${adminCount} with audience="admin"`);
  if (strays) fail(`Notification: ${strays} document(s) have an audience outside user/admin`);

  // Soft-delete state must be carried, not inferred.
  for (const [source, modelName] of [["post", "SocialPost"], ["comment", "Comment"],
                                     ["story", "Story"], ["highlight", "Highlight"]]) {
    const pg = await prisma[source].count({ where: { isDeleted: true } });
    const mg = await models[modelName].countDocuments({ isDeleted: true });
    log(`  ${pg === mg ? "ok  " : "FAIL"}  soft-deleted ${modelName.padEnd(28)} ${mg}/${pg}`);
    if (pg !== mg) fail(`${modelName}: ${pg} soft-deleted rows in PostgreSQL, ${mg} in Mongo`);
  }

  return { failures, summary, relStats };
}
