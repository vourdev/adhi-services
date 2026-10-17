import "server-only";

import { cookies, headers } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { isBot } from "@/lib/analytics/classify";
import {
  VISITOR_COOKIE,
  VISITOR_MAX_AGE,
} from "@/lib/analytics/visitor-cookie";
import { TRAFFIC_SOURCES, type TrafficSource } from "@/lib/domain";
import { isProduction } from "@/lib/env";

import { resolveSession } from "../auth";
import { SESSION_COOKIE } from "../session";
import type { VisitorContext } from "./ingest";

/**
 * First-party analytics cookies. No fingerprinting, no third parties.
 *
 * - lb_vid: random browser ID, 1 year. Basis of "unique visitors".
 * - lb_sid: random session ID plus the session's traffic source, renewed on
 *   every event and expiring after 30 minutes of inactivity.
 * - lb_ignore: set from Settings to stop counting one browser.
 */

export { VISITOR_COOKIE };
export const VISIT_COOKIE = "lb_sid";
export const IGNORE_COOKIE = "lb_ignore";

const VISIT_MAX_AGE = 30 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type VisitorState = VisitorContext & {
  visitorId: string;
  sessionId: string;
};

function parseVisitor(
  visitorCookie: string | undefined,
  visitCookie: string | undefined,
  userAgent: string | null,
  siteHost: string | null
): VisitorState {
  const [storedSession, storedSource] = (visitCookie ?? "").split(".");
  const sessionValid = storedSession !== undefined && UUID.test(storedSession);
  const source =
    TRAFFIC_SOURCES.find((value) => value === storedSource) ?? null;
  return {
    visitorId:
      visitorCookie && UUID.test(visitorCookie)
        ? visitorCookie
        : crypto.randomUUID(),
    sessionId: sessionValid ? storedSession : crypto.randomUUID(),
    sessionSource: sessionValid ? source : null,
    userAgent,
    siteHost,
  };
}

export function readVisitor(request: NextRequest): VisitorState {
  return parseVisitor(
    request.cookies.get(VISITOR_COOKIE)?.value,
    request.cookies.get(VISIT_COOKIE)?.value,
    request.headers.get("user-agent"),
    request.headers.get("x-forwarded-host") ?? request.nextUrl.host
  );
}

/** Same as readVisitor, for Server Actions (no NextRequest available). */
export async function readVisitorFromHeaders(): Promise<VisitorState> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return parseVisitor(
    cookieStore.get(VISITOR_COOKIE)?.value,
    cookieStore.get(VISIT_COOKIE)?.value,
    headerStore.get("user-agent"),
    headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  );
}

export function writeVisitor(
  response: NextResponse,
  state: VisitorState,
  source: TrafficSource | null
): void {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };
  response.cookies.set(VISITOR_COOKIE, state.visitorId, {
    ...options,
    maxAge: VISITOR_MAX_AGE,
  });
  response.cookies.set(
    VISIT_COOKIE,
    source ? `${state.sessionId}.${source}` : state.sessionId,
    {
      ...options,
      maxAge: VISIT_MAX_AGE,
    }
  );
}

export type SkipReason = "bot" | "prefetch" | "ignored_browser" | "owner";

/**
 * Requests that must not be counted: crawlers and link previews, browser
 * prefetches, a browser the owner excluded, and the owner of `profileId`
 * while signed in. Other signed-in accounts are visitors like anyone else.
 */
export async function skipReason(
  request: NextRequest,
  profileId: string
): Promise<SkipReason | null> {
  if (isBot(request.headers.get("user-agent"))) return "bot";
  const purpose =
    request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "";
  if (
    purpose.includes("prefetch") ||
    request.headers.has("next-router-prefetch")
  )
    return "prefetch";
  if (request.cookies.get(IGNORE_COOKIE)?.value === "1")
    return "ignored_browser";
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await resolveSession(getDb(), token);
    if (session?.profile.id === profileId) return "owner";
  }
  return null;
}
