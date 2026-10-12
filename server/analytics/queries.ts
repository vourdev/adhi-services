import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Database } from "@/db/client";
import { analyticsEvents, orders, products, profileLinks } from "@/db/schema";
import { percentChange, rate } from "@/lib/analytics/metrics";
import {
  type DateRange,
  eachDay,
  previousRange,
  TZ_OFFSET_MS,
} from "@/lib/analytics/range";
import type { Device, EventType, TrafficSource } from "@/lib/domain";

/**
 * Read-side analytics. All aggregation happens in SQL; raw events are never
 * loaded into the app to compute totals. Every query is scoped to one
 * profile and one period.
 *
 * Unique visitors = distinct first-party browser IDs (lb_vid cookie) seen on
 * profile views in the period. It counts browsers, not people: one person on
 * two devices counts twice, a browser that blocks cookies may count more
 * than once.
 */

const dayBucket = sql<string>`strftime('%Y-%m-%d', (${analyticsEvents.occurredAt} + ${TZ_OFFSET_MS}) / 1000, 'unixepoch')`;

function inRange(
  profileId: string,
  range: DateRange,
  type?: EventType | EventType[]
): SQL {
  const conditions = [
    eq(analyticsEvents.profileId, profileId),
    gte(analyticsEvents.occurredAt, range.startMs),
    lt(analyticsEvents.occurredAt, range.endMs),
  ];
  if (typeof type === "string")
    conditions.push(eq(analyticsEvents.eventType, type));
  else if (type) conditions.push(inArray(analyticsEvents.eventType, type));
  return and(...conditions) as SQL;
}

const num = (value: unknown) => Number(value ?? 0);

// ---------------------------------------------------------------- overview

export type OverviewTotals = {
  profileViews: number;
  uniqueVisitors: number;
  sessions: number;
  linkClicks: number;
  ctr: number | null;
};

export async function getOverviewTotals(
  db: Database,
  profileId: string,
  range: DateRange
): Promise<OverviewTotals> {
  const [row] = await db
    .select({
      profileViews: sql<number>`sum(case when ${analyticsEvents.eventType} = 'profile_view' then 1 else 0 end)`,
      uniqueVisitors: sql<number>`count(distinct case when ${analyticsEvents.eventType} = 'profile_view' then ${analyticsEvents.visitorId} end)`,
      sessions: sql<number>`count(distinct case when ${analyticsEvents.eventType} = 'profile_view' then ${analyticsEvents.sessionId} end)`,
      linkClicks: sql<number>`sum(case when ${analyticsEvents.eventType} = 'link_click' then 1 else 0 end)`,
    })
    .from(analyticsEvents)
    .where(inRange(profileId, range, ["profile_view", "link_click"]));

  const profileViews = num(row?.profileViews);
  const linkClicks = num(row?.linkClicks);
  return {
    profileViews,
    uniqueVisitors: num(row?.uniqueVisitors),
    sessions: num(row?.sessions),
    linkClicks,
    ctr: rate(linkClicks, profileViews),
  };
}

export type MetricWithChange = {
  value: number | null;
  previous: number | null;
  change: number | null;
};

export type OverviewComparison = Record<keyof OverviewTotals, MetricWithChange>;

export async function getOverview(
  db: Database,
  profileId: string,
  range: DateRange
): Promise<OverviewComparison> {
  const [current, previous] = await Promise.all([
    getOverviewTotals(db, profileId, range),
    getOverviewTotals(db, profileId, previousRange(range)),
  ]);
  const compare = (key: keyof OverviewTotals): MetricWithChange => {
    const value = current[key];
    const before = previous[key];
    return {
      value,
      previous: before,
      change:
        value === null || before === null
          ? null
          : key === "ctr"
            ? value - before
            : percentChange(value, before),
    };
  };
  return {
    profileViews: compare("profileViews"),
    uniqueVisitors: compare("uniqueVisitors"),
    sessions: compare("sessions"),
    linkClicks: compare("linkClicks"),
    ctr: compare("ctr"),
  };
}

// ------------------------------------------------------------------ series

export type SeriesPoint = {
  date: string;
  views: number;
  visitors: number;
  clicks: number;
};

export async function getTrafficSeries(
  db: Database,
  profileId: string,
  range: DateRange
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: dayBucket,
      views: sql<number>`sum(case when ${analyticsEvents.eventType} = 'profile_view' then 1 else 0 end)`,
      visitors: sql<number>`count(distinct case when ${analyticsEvents.eventType} = 'profile_view' then ${analyticsEvents.visitorId} end)`,
      clicks: sql<number>`sum(case when ${analyticsEvents.eventType} = 'link_click' then 1 else 0 end)`,
    })
    .from(analyticsEvents)
    .where(inRange(profileId, range, ["profile_view", "link_click"]))
    .groupBy(dayBucket);

  const byDate = new Map(rows.map((row) => [row.date, row]));
  return eachDay(range).map((date) => {
    const row = byDate.get(date);
    return {
      date,
      views: num(row?.views),
      visitors: num(row?.visitors),
      clicks: num(row?.clicks),
    };
  });
}

// --------------------------------------------------------------- top links

export type TopLink = {
  linkId: string | null;
  title: string;
  url: string | null;
  clicks: number;
  /** Share of all link clicks in the period, percent. */
  share: number | null;
  /** Clicks ÷ profile views, percent. */
  ctr: number | null;
};

export async function getTopLinks(
  db: Database,
  profileId: string,
  range: DateRange,
  options: { limit?: number; profileViews?: number } = {}
): Promise<TopLink[]> {
  const rows = await db
    .select({ linkId: analyticsEvents.linkId, clicks: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(inRange(profileId, range, "link_click"))
    .groupBy(analyticsEvents.linkId)
    .orderBy(desc(sql`count(*)`));

  const ids = rows
    .map((row) => row.linkId)
    .filter((id): id is string => id !== null);
  const links = ids.length
    ? await db
        .select({
          id: profileLinks.id,
          title: profileLinks.title,
          url: profileLinks.url,
        })
        .from(profileLinks)
        .where(
          and(
            eq(profileLinks.profileId, profileId),
            inArray(profileLinks.id, ids)
          )
        )
    : [];
  const byId = new Map(links.map((link) => [link.id, link]));

  const total = rows.reduce((sum, row) => sum + num(row.clicks), 0);
  const views =
    options.profileViews ??
    (await getOverviewTotals(db, profileId, range)).profileViews;

  const result = rows.map((row) => {
    const link = row.linkId ? byId.get(row.linkId) : undefined;
    const clicks = num(row.clicks);
    return {
      linkId: link ? link.id : null,
      title: link?.title ?? "Link yang sudah dihapus",
      url: link?.url ?? null,
      clicks,
      share: rate(clicks, total),
      ctr: rate(clicks, views),
    };
  });
  return options.limit ? result.slice(0, options.limit) : result;
}

/** Clicks per link in the period, for the Links table. */
export async function getClicksByLink(
  db: Database,
  profileId: string,
  range: DateRange
): Promise<Map<string, number>> {
  const rows = await db
    .select({ linkId: analyticsEvents.linkId, clicks: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(
      and(
        inRange(profileId, range, "link_click"),
        isNotNull(analyticsEvents.linkId)
      )
    )
    .groupBy(analyticsEvents.linkId);
  return new Map(
    rows
      .filter((row) => row.linkId)
      .map((row) => [row.linkId as string, num(row.clicks)])
  );
}

// ----------------------------------------------------------------- sources

export type SourceRow = {
  source: TrafficSource;
  views: number;
  visitors: number;
};
export type ReferrerRow = { host: string; views: number };
export type CampaignRow = {
  campaign: string;
  source: string | null;
  views: number;
};
export type DeviceRow = { device: Device; views: number };

export async function getTrafficSources(
  db: Database,
  profileId: string,
  range: DateRange
) {
  const where = inRange(profileId, range, "profile_view");
  const [sources, referrers, campaigns, devices] = await Promise.all([
    db
      .select({
        source: analyticsEvents.source,
        views: sql<number>`count(*)`,
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`,
      })
      .from(analyticsEvents)
      .where(where)
      .groupBy(analyticsEvents.source)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        host: analyticsEvents.referrerHost,
        views: sql<number>`count(*)`,
      })
      .from(analyticsEvents)
      .where(and(where, isNotNull(analyticsEvents.referrerHost)))
      .groupBy(analyticsEvents.referrerHost)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({
        campaign: analyticsEvents.utmCampaign,
        source: analyticsEvents.utmSource,
        views: sql<number>`count(*)`,
      })
      .from(analyticsEvents)
      .where(and(where, isNotNull(analyticsEvents.utmCampaign)))
      .groupBy(analyticsEvents.utmCampaign, analyticsEvents.utmSource)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({ device: analyticsEvents.device, views: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(where)
      .groupBy(analyticsEvents.device)
      .orderBy(desc(sql`count(*)`)),
  ]);

  return {
    sources: sources.map((row) => ({
      source: row.source ?? "other",
      views: num(row.views),
      visitors: num(row.visitors),
    })) as SourceRow[],
    referrers: referrers.map((row) => ({
      host: row.host ?? "",
      views: num(row.views),
    })) as ReferrerRow[],
    campaigns: campaigns.map((row) => ({
      campaign: row.campaign ?? "",
      source: row.source,
      views: num(row.views),
    })) as CampaignRow[],
    devices: devices.map((row) => ({
      device: row.device ?? "unknown",
      views: num(row.views),
    })) as DeviceRow[],
  };
}

// --------------------------------------------------------- recent activity

export type ActivityRow = {
  id: string;
  eventType: EventType;
  occurredAt: number;
  label: string | null;
  source: TrafficSource | null;
  device: Device | null;
};

/** Latest events with the clicked link or product name. No visitor identifiers are returned. */
export async function getRecentActivity(
  db: Database,
  profileId: string,
  limit = 12
): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      id: analyticsEvents.id,
      eventType: analyticsEvents.eventType,
      occurredAt: analyticsEvents.occurredAt,
      linkTitle: profileLinks.title,
      productName: products.name,
      source: analyticsEvents.source,
      device: analyticsEvents.device,
    })
    .from(analyticsEvents)
    .leftJoin(profileLinks, eq(profileLinks.id, analyticsEvents.linkId))
    .leftJoin(products, eq(products.id, analyticsEvents.productId))
    .where(eq(analyticsEvents.profileId, profileId))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    occurredAt: row.occurredAt,
    label: row.linkTitle ?? row.productName ?? null,
    source: row.source,
    device: row.device,
  }));
}

// ---------------------------------------------------------------- per link

export async function getLinkAnalytics(
  db: Database,
  profileId: string,
  linkId: string,
  range: DateRange
) {
  const link = await db.query.profileLinks.findFirst({
    where: and(
      eq(profileLinks.id, linkId),
      eq(profileLinks.profileId, profileId)
    ),
  });
  if (!link) return null;

  const where = and(
    inRange(profileId, range, "link_click"),
    eq(analyticsEvents.linkId, linkId)
  );
  const [series, sources, totals] = await Promise.all([
    db
      .select({ date: dayBucket, clicks: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(where)
      .groupBy(dayBucket),
    db
      .select({ source: analyticsEvents.source, clicks: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(where)
      .groupBy(analyticsEvents.source)
      .orderBy(desc(sql`count(*)`)),
    getOverviewTotals(db, profileId, range),
  ]);

  const byDate = new Map(series.map((row) => [row.date, num(row.clicks)]));
  const clicks = series.reduce((sum, row) => sum + num(row.clicks), 0);
  return {
    link,
    clicks,
    profileViews: totals.profileViews,
    ctr: rate(clicks, totals.profileViews),
    share: rate(clicks, totals.linkClicks),
    series: eachDay(range).map((date) => ({
      date,
      clicks: byDate.get(date) ?? 0,
    })),
    sources: sources.map((row) => ({
      source: (row.source ?? "other") as TrafficSource,
      clicks: num(row.clicks),
    })),
  };
}

// ---------------------------------------------------------------- products

export type ProductMetrics = {
  productViews: number;
  productClicks: number;
  productCtr: number | null;
  whatsappClicks: number;
  checkoutStarts: number;
  paymentsInitiated: number;
  paymentsFailed: number;
  paidOrders: number;
  revenue: number;
  conversionRate: number | null;
};

export type ProductRow = {
  productId: string;
  name: string;
  checkoutMethod: "whatsapp" | "direct";
  views: number;
  clicks: number;
  whatsappClicks: number;
  checkoutStarts: number;
  paidOrders: number;
  revenue: number;
};

/**
 * Product funnel. WhatsApp clicks are hand-offs to a chat, not sales; only
 * orders verified paid by the payment webhook count as transactions and
 * revenue (taken from the orders table, by paid date).
 */
export async function getProductAnalytics(
  db: Database,
  profileId: string,
  range: DateRange
) {
  const productTypes: EventType[] = [
    "profile_view",
    "product_view",
    "product_click",
    "whatsapp_checkout_clicked",
    "checkout_started",
    "payment_initiated",
    "payment_failed",
  ];
  const paidWhere = and(
    eq(orders.profileId, profileId),
    eq(orders.status, "paid"),
    gte(orders.paidAt, new Date(range.startMs)),
    lt(orders.paidAt, new Date(range.endMs))
  );

  const [counts, perProductEvents, perProductOrders, catalog] =
    await Promise.all([
      db
        .select({
          type: analyticsEvents.eventType,
          total: sql<number>`count(*)`,
        })
        .from(analyticsEvents)
        .where(inRange(profileId, range, productTypes))
        .groupBy(analyticsEvents.eventType),
      db
        .select({
          productId: analyticsEvents.productId,
          type: analyticsEvents.eventType,
          total: sql<number>`count(*)`,
        })
        .from(analyticsEvents)
        .where(
          and(
            inRange(profileId, range, productTypes),
            isNotNull(analyticsEvents.productId)
          )
        )
        .groupBy(analyticsEvents.productId, analyticsEvents.eventType),
      db
        .select({
          productId: orders.productId,
          paidOrders: sql<number>`count(*)`,
          revenue: sql<number>`sum(${orders.amount})`,
        })
        .from(orders)
        .where(paidWhere)
        .groupBy(orders.productId),
      db
        .select({
          id: products.id,
          name: products.name,
          checkoutMethod: products.checkoutMethod,
        })
        .from(products)
        .where(eq(products.profileId, profileId)),
    ]);

  const totalOf = (type: EventType) =>
    num(counts.find((row) => row.type === type)?.total);
  const paidOrders = perProductOrders.reduce(
    (sum, row) => sum + num(row.paidOrders),
    0
  );
  const revenue = perProductOrders.reduce(
    (sum, row) => sum + num(row.revenue),
    0
  );
  const productViews = totalOf("product_view");
  const productClicks = totalOf("product_click");

  const metrics: ProductMetrics = {
    productViews,
    productClicks,
    productCtr: rate(productClicks, totalOf("profile_view")),
    whatsappClicks: totalOf("whatsapp_checkout_clicked"),
    checkoutStarts: totalOf("checkout_started"),
    paymentsInitiated: totalOf("payment_initiated"),
    paymentsFailed: totalOf("payment_failed"),
    paidOrders,
    revenue,
    conversionRate: rate(paidOrders, productViews),
  };

  const rows: ProductRow[] = catalog.map((product) => {
    const eventsFor = (type: EventType) =>
      num(
        perProductEvents.find(
          (row) => row.productId === product.id && row.type === type
        )?.total
      );
    const sales = perProductOrders.find((row) => row.productId === product.id);
    return {
      productId: product.id,
      name: product.name,
      checkoutMethod: product.checkoutMethod,
      views: eventsFor("product_view"),
      clicks: eventsFor("product_click"),
      whatsappClicks: eventsFor("whatsapp_checkout_clicked"),
      checkoutStarts: eventsFor("checkout_started"),
      paidOrders: num(sales?.paidOrders),
      revenue: num(sales?.revenue),
    };
  });

  const bestSellers = rows
    .filter((row) => row.paidOrders > 0)
    .sort((a, b) => b.paidOrders - a.paidOrders || b.revenue - a.revenue)
    .slice(0, 5);

  return { metrics, rows, bestSellers };
}
