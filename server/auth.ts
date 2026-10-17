import { and, count, eq, gt, lt, ne } from "drizzle-orm";

import type { Database } from "@/db/client";
import { authAttempts, profiles, sessions, users } from "@/db/schema";
import {
  getDummyPasswordHash,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from "@/lib/security";

/**
 * Account and session logic, free of Next.js APIs so it can be tested
 * directly. Cookie handling lives in server/session.ts.
 */

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILED_LOGINS = 5;

export type SignInResult =
  | { ok: true; token: string; userId: string; expiresAt: Date }
  | { ok: false; reason: "invalid" | "rate_limited" };

async function failedAttempts(
  db: Database,
  identifier: string,
  nowMs: number
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(authAttempts)
    .where(
      and(
        eq(authAttempts.identifier, identifier),
        gt(authAttempts.createdAt, new Date(nowMs - LOGIN_WINDOW_MS))
      )
    );
  return row?.value ?? 0;
}

/**
 * Verifies credentials and creates a session. Failed attempts are counted
 * per email and per client (hashed IP); either reaching the limit blocks
 * sign-in for the rest of the window.
 */
export async function signIn(
  db: Database,
  input: {
    email: string;
    password: string;
    clientKey: string | null;
    userAgent: string | null;
  },
  nowMs = Date.now()
): Promise<SignInResult> {
  const identifiers = [`email:${input.email}`];
  if (input.clientKey) identifiers.push(`client:${input.clientKey}`);

  for (const identifier of identifiers) {
    if ((await failedAttempts(db, identifier, nowMs)) >= MAX_FAILED_LOGINS) {
      return { ok: false, reason: "rate_limited" };
    }
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });
  const valid = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await getDummyPasswordHash())
  );

  if (!user || !valid) {
    await db.insert(authAttempts).values(
      identifiers.map((identifier) => ({
        identifier,
        createdAt: new Date(nowMs),
      }))
    );
    return { ok: false, reason: "invalid" };
  }

  await db
    .delete(authAttempts)
    .where(eq(authAttempts.identifier, `email:${input.email}`));
  const { token, expiresAt } = await createSession(
    db,
    user.id,
    input.userAgent,
    nowMs
  );
  return { ok: true, token, userId: user.id, expiresAt };
}

export async function createSession(
  db: Database,
  userId: string,
  userAgent: string | null,
  nowMs = Date.now()
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(nowMs + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    userAgent: userAgent?.slice(0, 200) ?? null,
    createdAt: new Date(nowMs),
  });
  return { token, expiresAt };
}

export type SessionOwner = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  profile: typeof profiles.$inferSelect;
};

/** Resolves a session token to its user and that user's profile, or null. */
export async function resolveSession(
  db: Database,
  token: string,
  nowMs = Date.now()
): Promise<SessionOwner | null> {
  if (!token || token.length > 200) return null;
  const sessionId = sha256(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() <= nowMs) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.ownerId, row.userId),
  });
  if (!profile) return null;

  return {
    sessionId: row.sessionId,
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
    },
    profile,
  };
}

export async function deleteSession(
  db: Database,
  token: string
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function deleteOtherSessions(
  db: Database,
  userId: string,
  keepSessionId: string | null
): Promise<void> {
  await db
    .delete(sessions)
    .where(
      keepSessionId
        ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId))
        : eq(sessions.userId, userId)
    );
}

export async function countActiveSessions(
  db: Database,
  userId: string,
  nowMs = Date.now()
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(sessions)
    .where(
      and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date(nowMs)))
    );
  return row?.value ?? 0;
}

export async function changePassword(
  db: Database,
  input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    keepSessionId: string;
  }
): Promise<{ ok: true } | { ok: false; reason: "wrong_password" }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (
    !user ||
    !(await verifyPassword(input.currentPassword, user.passwordHash))
  ) {
    return { ok: false, reason: "wrong_password" };
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.newPassword) })
    .where(eq(users.id, user.id));
  await deleteOtherSessions(db, user.id, input.keepSessionId);
  return { ok: true };
}

/** Housekeeping: drops expired sessions and old attempt rows. */
export async function purgeExpiredAuthRows(
  db: Database,
  nowMs = Date.now()
): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(nowMs)));
  await db
    .delete(authAttempts)
    .where(lt(authAttempts.createdAt, new Date(nowMs - LOGIN_WINDOW_MS)));
}
