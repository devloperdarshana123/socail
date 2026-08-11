#!/usr/bin/env node
// PostgreSQL → MongoDB data migration (Phase 8).
//
//   --preflight       inspect PostgreSQL only; writes nothing, touches no Mongo
//   --dry-run         map and validate every row; writes nothing
//   --indexes-only    sync indexes to the schemas; no data
//   --validate-only   compare an already-migrated Mongo against PostgreSQL
//   (no flag)         preflight → indexes → data → derived → validation
//
//   --only=user,post  restrict to named collections
//   --verbose         per-finding row ids and recommended actions
//   --report=FILE     write the machine-readable JSON report here
//   --force           proceed despite BLOCKER findings (records them in the report)
//
// Connection details come from the environment — DATABASE_URL for Postgres,
// MONGO_URI/MONGO_DB_NAME for Mongo. Nothing is hardcoded and no credential
// is printed.
//
// SAFETY: this process never issues a write, update or delete against
// PostgreSQL. The Prisma client is used for findMany/count only.
import process from "node:process";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { mongoose } from "../../../shared/database/mongodb/index.js";
import { migrateAll } from "./engine.js";
import { DERIVATIONS } from "./derive.js";
import { validateAll } from "./validate.js";
import { syncIndexes, findUndeclaredIndexes } from "./indexes.js";
import { preflight } from "./preflight.js";
import { PLAN, EXCLUDED } from "./plan.js";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => argv.find((a) => a.startsWith(`${f}=`))?.split("=").slice(1).join("=");

const preflightOnly = has("--preflight");
const dryRun = has("--dry-run");
const validateOnly = has("--validate-only");
const indexesOnly = has("--indexes-only");
const verbose = has("--verbose");
const force = has("--force");
const reportPath = val("--report") ?? null;
const only = val("--only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

const started = Date.now();
const log = (...a) => console.log(...a);

const mode = preflightOnly ? "PREFLIGHT ONLY"
  : indexesOnly ? "INDEXES ONLY"
  : validateOnly ? "VALIDATE ONLY"
  : dryRun ? "DRY RUN (no writes)"
  : "MIGRATE";

function requireEnv() {
  // --preflight reads PostgreSQL only, so it does not need a Mongo target.
  const needed = preflightOnly
    ? ["DATABASE_URL"]
    : ["DATABASE_URL", "MONGO_URI", "MONGO_DB_NAME"];
  const missing = needed.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(
      `\nMissing required environment variable(s): ${missing.join(", ")}\n\n` +
      `  DATABASE_URL   PostgreSQL connection string (read-only use)\n` +
      `  MONGO_URI      MongoDB connection string\n` +
      `  MONGO_DB_NAME  target database name\n`
    );
    process.exit(2);
  }
}

async function main() {
  requireEnv();

  log("─".repeat(72));
  log(" PostgreSQL → MongoDB migration");
  log(`  mode        ${mode}`);
  if (!preflightOnly) log(`  target db   ${process.env.MONGO_DB_NAME}`);
  if (only) log(`  only        ${only.join(", ")}`);
  log("─".repeat(72));

  const prisma = new PrismaClient();
  if (!preflightOnly) {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  }

  const report = { mode, startedAt: new Date().toISOString(), preflight: null,
                   indexes: null, migration: null, validation: null };
  let exitCode = 0;

  try {
    // ── Pre-flight ───────────────────────────────────────────────────────
    // Before anything is written: is there data PostgreSQL accepts that the
    // Mongo schemas cannot hold? Seeing the whole list up front beats
    // discovering it row by row, halfway through a production run.
    if (!validateOnly && !indexesOnly) {
      const pf = await preflight(prisma, { log, verbose });
      report.preflight = pf;

      if (pf.blockers.length && !dryRun && !preflightOnly && !force) {
        log(`\n${pf.blockers.length} BLOCKER finding(s). Nothing was written.`);
        log("Resolve them, or re-run with --dry-run to see the full picture.");
        log("--force overrides, and records the override in the report.");
        exitCode = 1;
        return;
      }
      if (pf.blockers.length && force) {
        log(`\n--force: proceeding despite ${pf.blockers.length} BLOCKER finding(s).`);
        report.forced = true;
      }
    }
    if (preflightOnly) {
      exitCode = report.preflight.blockers.length ? 1 : 0;
      return;
    }

    // ── Indexes ──────────────────────────────────────────────────────────
    // Before the data pass, so a source duplicate is reported as a failed row
    // rather than quietly accepted.
    if (!validateOnly) {
      report.indexes = await syncIndexes({ log, dryRun });
      const stray = await findUndeclaredIndexes();
      if (stray.length) {
        log("\n  Undeclared indexes still present (syncIndexes should have removed these):");
        for (const s of stray) log(`      ${s.model}: ${s.index} ${JSON.stringify(s.key)}`);
      }
    }
    if (indexesOnly) return;

    // ── Data ─────────────────────────────────────────────────────────────
    let results = null;
    if (!validateOnly) {
      log(`\nCollections (${only ? "filtered" : PLAN.length}):`);
      results = await migrateAll(prisma, { dryRun, log, only });
      report.migration = results;

      log("\nDerived fields:");
      for (const d of DERIVATIONS) await d.run(prisma, { dryRun, log });
    }

    // ── Validation ───────────────────────────────────────────────────────
    if (dryRun) {
      log("\nDry run — validation skipped (nothing was written to validate).");
    } else {
      log("\n" + "─".repeat(72));
      log(" VALIDATION");
      log("─".repeat(72));
      const validation = await validateAll(prisma, { log });
      report.validation = {
        failures: validation.failures,
        summary: validation.summary,
        relationships: validation.relStats,
      };

      log("\n" + "─".repeat(72));
      if (validation.failures.length) {
        log(` VALIDATION FAILED — ${validation.failures.length} problem(s)`);
        log("─".repeat(72));
        for (const f of validation.failures) log(`  • ${f}`);
        log("\n Do NOT cut over. See README.md → Rollback.");
        exitCode = 1;
      } else {
        log(" VALIDATION PASSED — counts, ids, relationships, fields, counters,");
        log(" timestamps and derived arrays all agree with PostgreSQL.");
        log("─".repeat(72));
      }
    }

    if (results) {
      const total = Object.values(results).reduce(
        (a, r) => ({
          source: a.source + r.source, inserted: a.inserted + r.inserted,
          updated: a.updated + r.updated, skipped: a.skipped + r.skipped,
          failed: a.failed + r.failed, duplicates: a.duplicates + r.duplicates,
        }),
        { source: 0, inserted: 0, updated: 0, skipped: 0, failed: 0, duplicates: 0 }
      );
      report.totals = total;
      log(`\nTotals  source=${total.source} inserted=${total.inserted} updated=${total.updated}` +
          ` skipped=${total.skipped} failed=${total.failed} duplicates=${total.duplicates}`);
      if (total.failed || total.duplicates) exitCode = 1;
    }

    log(`\nExcluded by design (${Object.keys(EXCLUDED).length}): ${Object.keys(EXCLUDED).join(", ")}`);
  } finally {
    report.finishedAt = new Date().toISOString();
    report.elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(1));
    report.exitCode = exitCode;
    if (reportPath) {
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      log(`\nMachine-readable report written to ${reportPath}`);
    }
    log(`Elapsed ${report.elapsedSeconds}s`);
    await prisma.$disconnect();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("\nMIGRATION ABORTED\n", err);
  process.exit(3);
});
