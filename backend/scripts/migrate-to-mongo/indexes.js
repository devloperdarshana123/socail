import { models } from "../../../shared/database/mongodb/index.js";

// ── INDEXES ──────────────────────────────────────────────────────────────
//
// Nothing here invents an index. Every index the application needs is already
// DECLARED on its schema (shared/database/mongodb/indexes/*.indexes.js, plus
// field-level `unique: true`), which means the schemas are the single source
// of truth and this module's only job is to make the database match them and
// then say what it did.
//
// `syncIndexes()` rather than `createIndexes()`: it also DROPS indexes the
// schema no longer declares. That matters after Phase 7 and Phase 8, which
// moved fields between collections — an index left behind on a field that no
// longer exists is dead weight on every write, and a stale unique index on a
// moved field would reject legitimate documents.
//
// Run this BEFORE the data pass. Unique indexes are how the migration finds
// out that Postgres held data the Mongo model considers duplicate — an insert
// that violates one is reported as a failure rather than silently dropped.

export async function syncIndexes({ log, dryRun }) {
  const report = [];

  for (const [name, Model] of Object.entries(models)) {
    if (!Model?.schema) continue;
    const declared = Model.schema.indexes();
    const fieldUnique = [];
    Model.schema.eachPath((p, t) => {
      if (t.options?.unique) fieldUnique.push(p);
    });

    if (!declared.length && !fieldUnique.length) continue;

    let dropped = [];
    if (!dryRun) {
      // syncIndexes returns the names it dropped.
      dropped = await Model.syncIndexes();
    }

    report.push({
      model: name,
      collection: Model.collection.name,
      declared: declared.map(([keys, opts]) => ({ keys, opts: opts ?? {} })),
      fieldUnique,
      dropped,
    });
  }

  log(`\nIndexes ${dryRun ? "(dry run — nothing applied)" : "synced"}:`);
  for (const r of report) {
    log(`  ${r.model} (${r.collection})`);
    for (const u of r.fieldUnique) log(`      unique  ${u}   [field-level]`);
    for (const d of r.declared) {
      const flags = Object.entries(d.opts)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      log(`      index   ${JSON.stringify(d.keys)}${flags ? "   " + flags : ""}`);
    }
    if (r.dropped?.length) log(`      dropped ${r.dropped.join(", ")}  [no longer declared]`);
  }
  return report;
}

/**
 * Report indexes that exist in the database but are not declared by any
 * schema. syncIndexes() removes these, so after a sync this should be empty —
 * it runs afterwards as a check on the sync rather than as a separate step.
 */
export async function findUndeclaredIndexes() {
  const stray = [];
  for (const [name, Model] of Object.entries(models)) {
    if (!Model?.schema) continue;
    let live;
    try {
      live = await Model.collection.indexes();
    } catch {
      continue; // collection does not exist yet
    }
    const declaredKeys = new Set(
      Model.schema.indexes().map(([k]) => JSON.stringify(k))
    );
    Model.schema.eachPath((p, t) => {
      if (t.options?.unique) declaredKeys.add(JSON.stringify({ [p]: 1 }));
    });
    // Text indexes need their own comparison. MongoDB does not report the
    // declared key — `{ fullName: "text" }` comes back as the internal
    // `{ _fts: "text", _ftsx: 1 }`, with the real fields moved to `weights`.
    // Comparing raw keys therefore flags every text index in the database as
    // undeclared, which is how this check first reported five phantom strays.
    const declaredText = new Set();
    for (const [keys] of Model.schema.indexes()) {
      for (const [field, dir] of Object.entries(keys)) {
        if (dir === "text") declaredText.add(field);
      }
    }

    for (const ix of live) {
      if (ix.name === "_id_") continue;
      if (ix.textIndexVersion || ix.key?._fts === "text") {
        const covered = Object.keys(ix.weights ?? {}).every((f) => declaredText.has(f));
        if (!covered) {
          stray.push({ model: name, index: ix.name, key: ix.weights ?? ix.key, text: true });
        }
        continue;
      }
      if (!declaredKeys.has(JSON.stringify(ix.key))) {
        stray.push({ model: name, index: ix.name, key: ix.key });
      }
    }
  }
  return stray;
}
