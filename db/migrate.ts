import { resolve } from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";

import type { Database } from "./client";

export const MIGRATIONS_FOLDER = resolve(process.cwd(), "db/migrations");

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
