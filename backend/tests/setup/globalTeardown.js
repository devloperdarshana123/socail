import { rmSync, existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { TEST_DB_DIR, TEST_ENV_FILE } from "./testDbConfig.js";

// Best-effort removal that tolerates the Windows race where `postgres.exe`
// still holds file handles on the data dir for a moment after stop() has
// returned (see tests/README.md). If it can't delete now, it's harmless —
// globalSetup rms any stale .pgdata at the start of the next run. So this
// must never throw, or it would corrupt an otherwise-passing run's exit code.
async function bestEffortRemove(path) {
  if (!existsSync(path)) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch {
      await sleep(500);
    }
  }
  // Give up quietly — next run's globalSetup will clean it.
}

export default async function globalTeardown() {
  const pg = globalThis.__EROVIANS_TEST_PG__;
  if (pg) {
    try {
      await pg.stop();
    } catch {
      // stop() can throw on Windows if the process is already gone — ignore.
    }
  }

  await bestEffortRemove(TEST_DB_DIR);
  await bestEffortRemove(TEST_ENV_FILE);
}
