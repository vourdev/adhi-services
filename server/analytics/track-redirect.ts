import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db/client";

import { recordServerEvent, type ServerEventInput } from "./ingest";
import { readVisitor, skipReason, writeVisitor } from "./visitor";

/**
 * Records a click server-side, then redirects. Works without JavaScript and
 * cannot be double-counted by React re-renders. Responses are never cached.
 */
export async function trackedRedirect(
  request: NextRequest,
  destination: string,
  event: Omit<ServerEventInput, "dedupe">
): Promise<NextResponse> {
  const response = NextResponse.redirect(
    new URL(destination, request.url),
    302
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  if (request.method !== "GET" || (await skipReason(request, event.profileId))) return response;

  const visitor = readVisitor(request);
  try {
    await recordServerEvent(getDb(), { ...event, dedupe: true }, visitor);
    writeVisitor(response, visitor, visitor.sessionSource);
  } catch (error) {
    // Losing one analytics event must never block the visitor's navigation.
    console.error("[track] failed to record", event.type, error);
  }
  return response;
}

export function notFoundRedirect(
  request: NextRequest,
  fallback = "/"
): NextResponse {
  const response = NextResponse.redirect(new URL(fallback, request.url), 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
