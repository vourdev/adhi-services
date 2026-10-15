import { type NextRequest, NextResponse } from "next/server";
import * as z from "zod";

import { getDb } from "@/db/client";
import { CLIENT_EVENT_TYPES } from "@/lib/domain";
import { ingestClientEvent } from "@/server/analytics/ingest";
import {
  readVisitor,
  skipReason,
  writeVisitor,
} from "@/server/analytics/visitor";
import { isSameOrigin } from "@/server/http";

/**
 * Page-view beacon for the public profile, product and checkout pages.
 * The browser only says what was viewed; the server checks the target,
 * classifies the source, sets first-party cookies and stores the event.
 */

const bodySchema = z.object({
  type: z.enum(CLIENT_EVENT_TYPES),
  eventKey: z.uuid(),
  profileId: z.uuid(),
  productId: z.uuid().nullish(),
  referrer: z.string().max(2048).nullish(),
  utmSource: z.string().max(200).nullish(),
  utmMedium: z.string().max(200).nullish(),
  utmCampaign: z.string().max(200).nullish(),
});

const noContent = () =>
  new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const text = await request.text();
  if (text.length > 8192)
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });

  if (await skipReason(request, parsed.data.profileId)) return noContent();

  const visitor = readVisitor(request);
  const result = await ingestClientEvent(getDb(), parsed.data, visitor);
  const response = noContent();
  // A repeat view still keeps the visit (session cookie) alive.
  if (result.recorded || result.reason === "repeat")
    writeVisitor(response, visitor, result.source);
  return response;
}
