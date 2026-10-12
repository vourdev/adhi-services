import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Database } from "@/db/client";

/**
 * A fresh SQLite file with all migrations applied. Each test file runs in
 * its own process, so setting DATABASE_URL here is isolated per file.
 */
export async function createTestDb(): Promise<{
  db: Database;
  cleanup: () => void;
}> {
  const dir = mkdtempSync(join(tmpdir(), "linkbio-test-"));
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
  const { getDb, getClient } = await import("@/db/client");
  const { runMigrations } = await import("@/db/migrate");
  const db = getDb();
  await runMigrations(db);
  return {
    db,
    cleanup: () => {
      getClient().close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
