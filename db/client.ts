import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { databaseConfig } from "@/lib/env";

import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;
/** The handle inside db.transaction(); accepts the same queries as Database. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type Holder = { client: Client; db: Database; schema: typeof schema };

const globalForDb = globalThis as typeof globalThis & {
  __linkbioDb?: Holder;
  __linkbioWriteQueue?: Promise<unknown>;
};

function ensureLocalDirectory(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  if (path && path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true });
}

function open(): Holder {
  const config = databaseConfig();
  ensureLocalDirectory(config.url);
  const client = createClient(config);
  return { client, db: drizzle(client, { schema }), schema };
}

/** One client per process. Reused across hot reloads in development. */
function holder(): Holder {
  const current = globalForDb.__linkbioDb;
  if (!current) {
    globalForDb.__linkbioDb = open();
    return globalForDb.__linkbioDb;
  }
  // After a hot reload that changed db/schema.ts, rebuild the query layer on the same connection.
  if (current.schema !== schema) {
    current.db = drizzle(current.client, { schema });
    current.schema = schema;
  }
  return current;
}

export function getDb(): Database {
  return holder().db;
}

export function getClient(): Client {
  return holder().client;
}

/**
 * Runs a write transaction once every earlier one in this process has
 * finished. SQLite has one writer at a time and the local driver cannot
 * wait for a lock without blocking the event loop, so two interleaved write
 * transactions (two checkouts, a checkout and a webhook) would make the
 * second fail with SQLITE_BUSY. Queued here, the second simply waits.
 */
export function writeTransaction<T>(
  db: Database,
  run: (tx: Transaction) => Promise<T>
): Promise<T> {
  const previous = globalForDb.__linkbioWriteQueue ?? Promise.resolve();
  const result = previous.then(() => db.transaction(run));
  globalForDb.__linkbioWriteQueue = result.catch(() => undefined);
  return result;
}
