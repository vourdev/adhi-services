import { and, count, eq, gt } from "drizzle-orm";

import type { Database } from "@/db/client";
import { authAttempts } from "@/db/schema";

/**
 * Fixed-window limiter stored in the database, so it holds across server
 * instances. Records an attempt and returns false once `max` attempts were
 * made within `windowMs`.
 */
export async function allowAttempt(
  db: Database,
  identifier: string,
  options: { windowMs: number; max: number },
  nowMs = Date.now()
): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(authAttempts)
    .where(
      and(
        eq(authAttempts.identifier, identifier),
        gt(authAttempts.createdAt, new Date(nowMs - options.windowMs))
      )
    );
  if ((row?.value ?? 0) >= options.max) return false;
  await db
    .insert(authAttempts)
    .values({ identifier, createdAt: new Date(nowMs) });
  return true;
}
