import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { orders, profiles, users } from "@/db/schema";
import { hmacSha256, isOrderCode, safeEqual, sha256 } from "@/lib/security";

/**
 * How a buyer gets back to their order page. The order page needs the
 * order's secret token; Midtrans' finish and error redirects per order
 * carry it, but the dashboard redirects (Unfinish, and Finish/Error as a
 * fallback) only carry the order number. For those, the buyer's browser
 * keeps its recent order links in an HttpOnly cookie set at checkout.
 */

/** What the buyer was told on the Midtrans side; shown as a note on the order page. */
export const PAYMENT_OUTCOMES = ["selesai", "belum-selesai", "gagal"] as const;
export type PaymentOutcome = (typeof PAYMENT_OUTCOMES)[number];

export function isPaymentOutcome(value: unknown): value is PaymentOutcome {
  return (PAYMENT_OUTCOMES as readonly unknown[]).includes(value);
}

/** The buyer's order page. `outcome` adds a note about what just happened at Midtrans. */
export function orderPath(
  code: string,
  token: string,
  outcome: PaymentOutcome | null = null
): string {
  const note = outcome && outcome !== "selesai" ? `&hasil=${outcome}` : "";
  return `/pesanan/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}${note}`;
}

// ----------------------------------------------------------- email links

/**
 * The order link in emails. Only a hash of the order's token is stored, so
 * a server-side email cannot carry the token itself; it carries this key,
 * derived from that hash. Issuing a new order link (which replaces the
 * hash) therefore also retires every link already emailed.
 */
export function orderEmailKey(
  code: string,
  accessTokenHash: string,
  secret: string
): string {
  return hmacSha256(secret, `order-email:${code}:${accessTokenHash}`);
}

export function isOrderEmailKey(
  key: string,
  code: string,
  accessTokenHash: string,
  secret: string
): boolean {
  return safeEqual(orderEmailKey(code, accessTokenHash, secret), key);
}

/** Query string that opens an order page: the buyer's token, or an email key. */
export function orderAccessQuery(access: {
  token?: string | null;
  key?: string | null;
}): string {
  return access.token
    ? `t=${encodeURIComponent(access.token)}`
    : `k=${encodeURIComponent(access.key ?? "")}`;
}

// ------------------------------------------------------------ the cookie

export const RECENT_ORDERS_COOKIE = "lb_orders";
export const RECENT_ORDERS_MAX_AGE_S = 7 * 24 * 60 * 60;
const MAX_RECENT_ORDERS = 5;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

/** "CODE:TOKEN|CODE:TOKEN", newest first. Malformed entries are dropped. */
function parseRecentOrders(cookie: string | null | undefined) {
  if (!cookie) return [];
  return cookie
    .slice(0, 2000)
    .split("|")
    .flatMap((entry) => {
      const [code, token, ...rest] = entry.split(":");
      return code &&
        token &&
        rest.length === 0 &&
        isOrderCode(code) &&
        TOKEN_PATTERN.test(token)
        ? [{ code, token }]
        : [];
    });
}

/** The cookie value with this order added in front (at most five are kept). */
export function addRecentOrder(
  cookie: string | null | undefined,
  code: string,
  token: string
): string {
  return [
    { code, token },
    ...parseRecentOrders(cookie).filter((entry) => entry.code !== code),
  ]
    .slice(0, MAX_RECENT_ORDERS)
    .map((entry) => `${entry.code}:${entry.token}`)
    .join("|");
}

export function recentOrderToken(
  cookie: string | null | undefined,
  code: string
): string | null {
  return (
    parseRecentOrders(cookie).find((entry) => entry.code === code)?.token ??
    null
  );
}

/** One cookie's value from a Cookie request header. */
export function readCookie(
  header: string | null | undefined,
  name: string
): string | null {
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ------------------------------------------------------- the redirects

function stringField(value: unknown, field: string): string | null {
  if (typeof value !== "object" || value === null) return null;
  const found = (value as Record<string, unknown>)[field];
  return typeof found === "string" ? found : null;
}

/**
 * The order number in a Midtrans redirect: in the query string, or, for
 * payment methods that return with a POST, in the form or JSON body (some
 * send the whole result as a `response` field holding JSON). Used only to
 * find the order; the status always comes from Midtrans itself.
 */
export async function redirectOrderId(
  request: Request
): Promise<string | null> {
  const fromQuery = new URL(request.url).searchParams.get("order_id");
  if (fromQuery) return fromQuery;
  if (request.method !== "POST") return null;
  try {
    const text = (await request.text()).slice(0, 20_000);
    if ((request.headers.get("content-type") ?? "").includes("json"))
      return stringField(JSON.parse(text), "order_id");
    const form = new URLSearchParams(text);
    const response = form.get("response");
    return (
      form.get("order_id") ??
      (response ? stringField(JSON.parse(response), "order_id") : null)
    );
  } catch {
    return null;
  }
}

/**
 * Where a Midtrans redirect sends the buyer: their order page when this
 * browser holds the order's link, otherwise a general page for the outcome.
 * A token from the cookie is checked against the order before it is used.
 */
export async function redirectTarget(
  db: Database,
  outcome: PaymentOutcome,
  orderId: string | null,
  cookie: string | null
): Promise<string> {
  const code = orderId && isOrderCode(orderId) ? orderId : null;
  const token = code ? recentOrderToken(cookie, code) : null;
  if (code && token) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.code, code),
      columns: { accessTokenHash: true },
    });
    if (order && safeEqual(order.accessTokenHash, sha256(token)))
      return orderPath(code, token, outcome);
  }
  return `/pembayaran/${outcome}${code ? `?pesanan=${code}` : ""}`;
}

/** Handles a Midtrans browser redirect (GET or POST) with a 303 to the right page. */
export async function midtransRedirect(
  db: Database,
  request: Request,
  outcome: PaymentOutcome
): Promise<Response> {
  let target = `/pembayaran/${outcome}`;
  try {
    target = await redirectTarget(
      db,
      outcome,
      await redirectOrderId(request),
      readCookie(request.headers.get("cookie"), RECENT_ORDERS_COOKIE)
    );
  } catch (error) {
    // The general page still tells the buyer what to do next.
    console.error("[midtrans] redirect lookup failed", error);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(target, request.url).toString(),
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Who sold an order, for the general result pages: enough to send the
 * buyer back to the seller, nothing about the order itself. Null when the
 * profile is not public.
 */
export async function orderSeller(db: Database, code: string) {
  if (!isOrderCode(code)) return null;
  const [row] = await db
    .select({
      profileId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      isPublished: profiles.isPublished,
      ownerStatus: users.status,
    })
    .from(orders)
    .innerJoin(profiles, eq(profiles.id, orders.profileId))
    .innerJoin(users, eq(users.id, profiles.ownerId))
    .where(eq(orders.code, code))
    .limit(1);
  return row?.isPublished && row.ownerStatus === "active"
    ? {
        profileId: row.profileId,
        username: row.username,
        displayName: row.displayName,
      }
    : null;
}
