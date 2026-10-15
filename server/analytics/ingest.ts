import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  analyticsEvents,
  products,
  profileLinks,
  profiles,
  users,
} from "@/db/schema";
import {
  classifySource,
  cleanUtm,
  detectDevice,
  referrerHost,
} from "@/lib/analytics/classify";
import type { ClientEventType, EventType, TrafficSource } from "@/lib/domain";

/**
 * Event ingestion. Two entry points:
 *
 * - ingestClientEvent: page views reported by the browser beacon. The
 *   profile/product relation is checked here, and the client's eventKey is
 *   a unique key, so a re-sent or double-fired beacon is stored once.
 * - recordServerEvent: clicks, WhatsApp handoffs and payment events,
 *   recorded by route handlers and the payment service.
 */

export type VisitorContext = {
  visitorId: string | null;
  sessionId: string | null;
  /** Source of the visit that started this session, carried in the session cookie. */
  sessionSource: TrafficSource | null;
  userAgent: string | null;
  siteHost: string | null;
};

export type ClientEventInput = {
  type: ClientEventType;
  eventKey: string;
  profileId: string;
  productId?: string | null | undefined;
  referrer?: string | null | undefined;
  utmSource?: string | null | undefined;
  utmMedium?: string | null | undefined;
  utmCampaign?: string | null | undefined;
};

export type IngestResult =
  | { recorded: true; source: TrafficSource }
  | { recorded: false; reason: "repeat"; source: TrafficSource }
  | { recorded: false; reason: "duplicate" | "unknown_target" | "unpublished" };

/**
 * A browser viewing the same page again within this window (a reload, going
 * back to the profile) is the same visit and is counted once.
 */
export const VIEW_DEDUPE_MS = 30 * 60 * 1000;

/** Source for a page view: in-site navigation keeps the session's original source. */
export function resolveSource(
  input: {
    referrer: string | null;
    utmSource: string | null;
    utmMedium: string | null;
  },
  context: Pick<VisitorContext, "sessionSource" | "siteHost">
): { source: TrafficSource; referrerHost: string | null } {
  const host = referrerHost(input.referrer);
  const siteHost =
    context.siteHost?.toLowerCase().replace(/^www\./, "") ?? null;
  const internal = host !== null && siteHost !== null && host === siteHost;
  if (
    (internal || (!host && !input.utmSource && !input.utmMedium)) &&
    context.sessionSource
  ) {
    return {
      source: context.sessionSource,
      referrerHost: internal ? null : host,
    };
  }
  return {
    source: classifySource({
      referrerHost: host,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      siteHost,
    }),
    referrerHost: internal ? null : host,
  };
}

export async function ingestClientEvent(
  db: Database,
  input: ClientEventInput,
  context: VisitorContext,
  nowMs = Date.now()
): Promise<IngestResult> {
  const [profile] = await db
    .select({
      id: profiles.id,
      isPublished: profiles.isPublished,
      ownerStatus: users.status,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.ownerId))
    .where(eq(profiles.id, input.profileId))
    .limit(1);
  if (!profile) return { recorded: false, reason: "unknown_target" };
  // A suspended owner's page is offline, so it has no visits to count.
  if (!profile.isPublished || profile.ownerStatus !== "active")
    return { recorded: false, reason: "unpublished" };

  let productId: string | null = null;
  if (input.type !== "profile_view") {
    if (!input.productId) return { recorded: false, reason: "unknown_target" };
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, input.productId),
        eq(products.profileId, profile.id)
      ),
      columns: { id: true, status: true },
    });
    if (!product) return { recorded: false, reason: "unknown_target" };
    if (product.status !== "published")
      return { recorded: false, reason: "unpublished" };
    productId = product.id;
  }

  const utmSource = cleanUtm(input.utmSource);
  const utmMedium = cleanUtm(input.utmMedium);
  const { source, referrerHost: host } = resolveSource(
    { referrer: input.referrer ?? null, utmSource, utmMedium },
    context
  );

  if (context.visitorId) {
    const recent = await db
      .select({ id: analyticsEvents.id })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.visitorId, context.visitorId),
          eq(analyticsEvents.eventType, input.type),
          eq(analyticsEvents.profileId, profile.id),
          productId
            ? eq(analyticsEvents.productId, productId)
            : isNull(analyticsEvents.productId),
          gt(analyticsEvents.occurredAt, nowMs - VIEW_DEDUPE_MS)
        )
      )
      .limit(1);
    if (recent.length > 0)
      return {
        recorded: false,
        reason: "repeat",
        source: context.sessionSource ?? source,
      };
  }

  const inserted = await db
    .insert(analyticsEvents)
    .values({
      eventKey: input.eventKey,
      profileId: profile.id,
      productId,
      eventType: input.type,
      occurredAt: nowMs,
      visitorId: context.visitorId,
      sessionId: context.sessionId,
      source,
      referrerHost: host,
      utmSource,
      utmMedium,
      utmCampaign: cleanUtm(input.utmCampaign),
      device: detectDevice(context.userAgent),
    })
    .onConflictDoNothing({ target: analyticsEvents.eventKey })
    .returning({ id: analyticsEvents.id });

  return inserted.length > 0
    ? { recorded: true, source }
    : { recorded: false, reason: "duplicate" };
}

/** Repeated clicks on the same target by the same browser within this window count once. */
export const CLICK_DEDUPE_MS = 2000;

export type ServerEventInput = {
  profileId: string;
  type: EventType;
  linkId?: string | null;
  productId?: string | null;
  orderId?: string | null;
  /** Skip if the same visitor recorded the same event on the same target within CLICK_DEDUPE_MS. */
  dedupe?: boolean;
};

export async function recordServerEvent(
  db: Database,
  input: ServerEventInput,
  context: VisitorContext,
  nowMs = Date.now()
): Promise<boolean> {
  if (input.dedupe && context.visitorId) {
    const conditions = [
      eq(analyticsEvents.visitorId, context.visitorId),
      eq(analyticsEvents.eventType, input.type),
      gt(analyticsEvents.occurredAt, nowMs - CLICK_DEDUPE_MS),
    ];
    if (input.linkId) conditions.push(eq(analyticsEvents.linkId, input.linkId));
    if (input.productId)
      conditions.push(eq(analyticsEvents.productId, input.productId));
    const recent = await db
      .select({ id: analyticsEvents.id })
      .from(analyticsEvents)
      .where(and(...conditions))
      .limit(1);
    if (recent.length > 0) return false;
  }

  await db.insert(analyticsEvents).values({
    profileId: input.profileId,
    linkId: input.linkId ?? null,
    productId: input.productId ?? null,
    orderId: input.orderId ?? null,
    eventType: input.type,
    occurredAt: nowMs,
    visitorId: context.visitorId,
    sessionId: context.sessionId,
    source: context.sessionSource,
    device: detectDevice(context.userAgent),
  });
  return true;
}

/**
 * Looks up an active link for the /go redirect, with its owning profile.
 * `isPublished` is false when the owner is suspended: their pages are offline.
 */
export async function findTrackableLink(db: Database, linkId: string) {
  const [row] = await db
    .select({
      id: profileLinks.id,
      url: profileLinks.url,
      message: profileLinks.message,
      kind: profileLinks.kind,
      isActive: profileLinks.isActive,
      profileId: profiles.id,
      username: profiles.username,
      isPublished: profiles.isPublished,
      whatsappNumber: profiles.whatsappNumber,
      ownerStatus: users.status,
    })
    .from(profileLinks)
    .innerJoin(profiles, eq(profiles.id, profileLinks.profileId))
    .innerJoin(users, eq(users.id, profiles.ownerId))
    .where(eq(profileLinks.id, linkId))
    .limit(1);
  if (!row) return null;
  const { ownerStatus, ...link } = row;
  return { ...link, isPublished: link.isPublished && ownerStatus === "active" };
}

/** Same as findTrackableLink, for product cards. */
export async function findTrackableProduct(db: Database, productId: string) {
  const [row] = await db
    .select({
      product: products,
      username: profiles.username,
      isPublished: profiles.isPublished,
      profile: profiles,
      ownerStatus: users.status,
    })
    .from(products)
    .innerJoin(profiles, eq(profiles.id, products.profileId))
    .innerJoin(users, eq(users.id, profiles.ownerId))
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) return null;
  const { ownerStatus, ...found } = row;
  return {
    ...found,
    isPublished: found.isPublished && ownerStatus === "active",
  };
}
