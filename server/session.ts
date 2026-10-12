import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getDb } from "@/db/client";
import { isProduction } from "@/lib/env";
import { sha256 } from "@/lib/security";

import { resolveSession, type SessionOwner } from "./auth";

export const SESSION_COOKIE = "lb_session";

/**
 * The signed-in owner for this request, or null. Memoised per render pass;
 * Server Actions and Route Handlers call it fresh every time.
 */
export const getCurrentOwner = cache(async (): Promise<SessionOwner | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(getDb(), token);
});

/** For admin pages and actions: the owner, or a redirect to the sign-in page. */
export async function requireOwner(): Promise<SessionOwner> {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/admin/login");
  return owner;
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date
): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** First address in X-Forwarded-For, or X-Real-IP. Only used hashed, for rate limits. */
export function clientIp(source: Headers): string | null {
  const forwarded = source.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || source.get("x-real-ip")?.trim() || null;
}

/** A hashed client identifier for rate limiting. The raw IP is never stored. */
export async function clientKey(): Promise<string | null> {
  const ip = clientIp(await headers());
  return ip ? sha256(`client:${ip}`).slice(0, 32) : null;
}
