import {
  and,
  count,
  desc,
  eq,
  inArray,
  like,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import * as z from "zod";

import { type Database, writeTransaction } from "@/db/client";
import {
  digitalDeliveries,
  orderItems,
  orders,
  paymentTransactions,
  products,
  profiles,
  webhookEvents,
  type Order,
} from "@/db/schema";
import type { OrderStatus } from "@/lib/domain";
import { priceCart } from "@/lib/pricing";
import { quantityLimits, quantityProblem } from "@/lib/quantity";
import { fail, isUniqueViolation, ok, type Result } from "@/lib/result";
import {
  generateOrderCode,
  randomToken,
  safeEqual,
  sha256,
  signExpiring,
} from "@/lib/security";
import type { CheckoutInput } from "@/lib/validation";

import { recordServerEvent, type VisitorContext } from "./analytics/ingest";
import {
  type AppliedCode,
  checkDiscountCode,
  CODE_REJECTION_MESSAGES,
  countCodeUses,
} from "./discount-codes";
import { isOrderEmailKey, orderPath } from "./order-access";
import {
  GatewayError,
  type GatewayStatus,
  mapProviderStatus,
  nextOrderStatus,
  type NotificationPayload,
  type PaymentGateway,
} from "./payments/gateway";

/**
 * Direct checkout: orders, payment transactions, webhook processing and
 * digital delivery. An order only becomes "paid" from a status the server
 * fetched or verified itself (signed webhook + status API), never from the
 * browser's redirect back to the site.
 */

const NO_VISITOR: VisitorContext = {
  visitorId: null,
  sessionId: null,
  sessionSource: null,
  userAgent: null,
  siteHost: null,
};

/** Thrown inside the order transaction when a limited code ran out meanwhile; rolls the insert back. */
class CodeUsedUp extends Error {}

export function orderAccessUrl(
  siteUrl: string,
  code: string,
  token: string
): string {
  return `${siteUrl}${orderPath(code, token)}`;
}

// --------------------------------------------------------------- checkout

export async function startCheckout(
  db: Database,
  gateway: PaymentGateway,
  input: CheckoutInput,
  context: {
    siteUrl: string;
    visitor: VisitorContext;
    notificationUrl?: string | null;
  },
  nowMs = Date.now()
): Promise<
  Result<{
    orderId: string;
    orderCode: string;
    redirectUrl: string;
    /** The order's secret link token; null when a repeated submit reused an earlier order. */
    accessToken: string | null;
  }>
> {
  const ids = input.items.map((item) => item.productId);
  const rows = await db
    .select({ product: products, profilePublished: profiles.isPublished })
    .from(products)
    .innerJoin(profiles, eq(profiles.id, products.profileId))
    .where(inArray(products.id, ids));
  const byId = new Map(rows.map((row) => [row.product.id, row]));
  // Every product must exist, be on sale and belong to the same seller.
  const profileId = rows[0]?.product.profileId;
  if (
    !profileId ||
    ids.some((id) => {
      const row = byId.get(id);
      return (
        !row ||
        row.product.status !== "published" ||
        !row.profilePublished ||
        row.product.profileId !== profileId
      );
    })
  ) {
    return fail(
      ids.length > 1
        ? "Ada produk di keranjang yang sudah tidak tersedia. Muat ulang halaman."
        : "Produk tidak tersedia."
    );
  }
  const items = ids.map((id) => byId.get(id)!.product);
  if (items.some((product) => product.checkoutMethod !== "direct"))
    return fail("Produk ini dipesan lewat WhatsApp.");
  const quantities = input.items.map((item) => item.quantity);
  for (const [index, product] of items.entries()) {
    const problem = quantityProblem(
      product.name,
      quantities[index]!,
      quantityLimits(product)
    );
    if (problem) return fail(problem);
  }

  // Same form submitted twice: reuse the order created the first time.
  const existing = await db.query.orders.findFirst({
    where: eq(orders.idempotencyKey, input.idempotencyKey),
  });
  if (existing) {
    const transaction = await db.query.paymentTransactions.findFirst({
      where: eq(paymentTransactions.orderId, existing.id),
    });
    const sameRequest =
      existing.amount === input.expectedAmount &&
      existing.discountCode === input.discountCode;
    if (
      sameRequest &&
      existing.status === "pending" &&
      transaction?.redirectUrl
    ) {
      return ok({
        orderId: existing.id,
        orderCode: existing.code,
        redirectUrl: transaction.redirectUrl,
        accessToken: null,
      });
    }
    return fail(
      "Pesanan sebelumnya tidak bisa dilanjutkan. Muat ulang halaman lalu coba lagi."
    );
  }

  // The price is computed now, on the server; the browser only tells us what it showed.
  const lines = items.map((product, index) => ({
    productId: product.id,
    listPrice: product.priceAmount * quantities[index]!,
  }));
  let applied: AppliedCode | null = null;
  if (input.discountCode) {
    const check = await checkDiscountCode(
      db,
      { profileId, items: lines, code: input.discountCode },
      nowMs
    );
    if (!check.ok) return fail(check.message);
    applied = check.applied;
  }
  const price = applied?.price ?? priceCart(lines, null);
  if (price.total !== input.expectedAmount) {
    return fail(
      "Total pembayaran berubah. Muat ulang halaman untuk melihat harga terbaru."
    );
  }
  if (price.lines.some((line) => line.finalPrice < 1))
    return fail("Produk ini tidak bisa dibayar online.");
  const token = randomToken();
  let order: Order | undefined;
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    try {
      order = await writeTransaction(db, async (tx) => {
        // Write transactions are serialized, so the last use of a limited code goes to one buyer.
        if (
          applied &&
          applied.maxUses !== null &&
          (await countCodeUses(tx, applied.id, nowMs)) >= applied.maxUses
        ) {
          throw new CodeUsedUp();
        }
        const [created] = await tx
          .insert(orders)
          .values({
            code: generateOrderCode(),
            profileId,
            // The first product; the full list is in order_items.
            productId: items[0]!.id,
            buyerName: input.buyerName,
            buyerEmail: input.buyerEmail,
            buyerPhone: input.buyerPhone,
            amount: price.total,
            discountCodeId: applied?.id ?? null,
            discountCode: applied?.code ?? null,
            discountAmount: price.discountAmount,
            paymentAccount: "platform",
            accessTokenHash: sha256(token),
            idempotencyKey: input.idempotencyKey,
            createdAt: new Date(nowMs),
          })
          .returning();
        if (!created) throw new Error("Order insert returned nothing");
        await tx.insert(orderItems).values(
          items.map((product, index) => ({
            orderId: created.id,
            productId: product.id,
            productName: product.name,
            quantity: quantities[index]!,
            listAmount: price.lines[index]!.listPrice,
            unitAmount: price.lines[index]!.finalPrice,
          }))
        );
        return created;
      });
    } catch (error) {
      if (error instanceof CodeUsedUp)
        return fail(CODE_REJECTION_MESSAGES.used_up);
      // An order-code collision retries; a repeated idempotency key means a parallel submit won.
      if (!isUniqueViolation(error)) throw error;
      const raced = await db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, input.idempotencyKey),
      });
      if (raced)
        return fail(
          "Pesanan sedang diproses. Tunggu sebentar lalu muat ulang halaman."
        );
    }
  }
  if (!order) return fail("Pesanan gagal dibuat. Coba lagi.");

  let payment: { token: string; redirectUrl: string };
  try {
    payment = await gateway.createTransaction({
      orderCode: order.code,
      amount: order.amount,
      // One line per product for its whole quantity: after a fixed code the
      // line total does not always split into equal unit prices.
      items: items.map((product, index) => ({
        id: product.id,
        name:
          quantities[index]! > 1
            ? `${product.name} (x${quantities[index]})`
            : product.name,
        price: price.lines[index]!.finalPrice,
      })),
      buyer: {
        name: input.buyerName,
        email: input.buyerEmail,
        phone: input.buyerPhone,
      },
      finishUrl: orderAccessUrl(context.siteUrl, order.code, token),
      errorUrl: `${context.siteUrl}${orderPath(order.code, token, "gagal")}`,
      notificationUrl: context.notificationUrl ?? null,
    });
  } catch (error) {
    await db
      .update(orders)
      .set({ status: "failed" })
      .where(eq(orders.id, order.id));
    console.error("[checkout] createTransaction failed", error);
    return fail(
      error instanceof GatewayError
        ? "Pembayaran belum bisa dibuat. Coba beberapa saat lagi."
        : "Terjadi kesalahan saat membuat pembayaran."
    );
  }

  await db.insert(paymentTransactions).values({
    orderId: order.id,
    provider: gateway.provider,
    providerOrderId: order.code,
    snapToken: payment.token,
    redirectUrl: payment.redirectUrl,
    grossAmount: order.amount,
  });
  await recordServerEvent(
    db,
    {
      profileId,
      type: "payment_initiated",
      productId: items[0]!.id,
      orderId: order.id,
    },
    context.visitor
  );

  return ok({
    orderId: order.id,
    orderCode: order.code,
    redirectUrl: payment.redirectUrl,
    accessToken: token,
  });
}

// ------------------------------------------------------------ status sync

export type ApplyResult =
  | { outcome: "applied"; status: OrderStatus }
  | { outcome: "unchanged"; status: OrderStatus }
  | { outcome: "rejected"; reason: "order_mismatch" | "amount_mismatch" };

/**
 * Applies a provider status to an order inside one transaction. The order
 * row is updated conditionally on its current status, so two concurrent
 * deliveries of the same notification cannot both apply it.
 */
export async function applyGatewayStatus(
  db: Database,
  order: Order,
  status: GatewayStatus,
  nowMs = Date.now()
): Promise<ApplyResult> {
  if (status.orderId !== order.code)
    return { outcome: "rejected", reason: "order_mismatch" };
  if (status.grossAmount !== order.amount)
    return { outcome: "rejected", reason: "amount_mismatch" };

  const target = nextOrderStatus(
    order.status,
    mapProviderStatus(status.transactionStatus, status.fraudStatus)
  );

  const applied = await writeTransaction(db, async (tx) => {
    await tx
      .update(paymentTransactions)
      .set({
        transactionStatus: status.transactionStatus,
        fraudStatus: status.fraudStatus,
        paymentType: status.paymentType,
        providerTransactionId: status.transactionId,
        statusCheckedAt: new Date(nowMs),
      })
      .where(eq(paymentTransactions.orderId, order.id));

    if (!target) return null;

    const updated = await tx
      .update(orders)
      .set({
        status: target,
        ...(target === "paid" ? { paidAt: new Date(nowMs) } : {}),
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
      .returning({ id: orders.id });
    if (updated.length === 0) return null;

    if (target === "paid") {
      // One download grant per product in the order that has a file or link.
      const delivered = await tx
        .select({ productId: products.id })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .where(
          and(
            eq(orderItems.orderId, order.id),
            ne(products.deliveryType, "none")
          )
        );
      if (delivered.length > 0) {
        await tx
          .insert(digitalDeliveries)
          .values(
            delivered.map((item) => ({
              orderId: order.id,
              productId: item.productId,
            }))
          )
          .onConflictDoNothing();
      }
    }
    return target;
  });

  if (!applied) {
    const fresh = await db.query.orders.findFirst({
      where: eq(orders.id, order.id),
      columns: { status: true },
    });
    return { outcome: "unchanged", status: fresh?.status ?? order.status };
  }

  if (
    applied === "paid" ||
    applied === "failed" ||
    applied === "expired" ||
    applied === "cancelled"
  ) {
    await recordServerEvent(
      db,
      {
        profileId: order.profileId,
        type: applied === "paid" ? "payment_succeeded" : "payment_failed",
        productId: order.productId,
        orderId: order.id,
      },
      NO_VISITOR,
      nowMs
    );
  }
  return { outcome: "applied", status: applied };
}

// ----------------------------------------------------------------- webhook

/** Optional text that Midtrans may also send as null. */
const optionalField = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((value) => value ?? undefined);

// Only the fields the handler uses are checked; Midtrans adds many more.
// Order IDs from other systems on the same account (and the dashboard's
// test notifications) are longer than this site's own order numbers.
const notificationSchema = z.object({
  order_id: z.string().min(1).max(255),
  status_code: z.string().min(1).max(8),
  gross_amount: z.string().min(1).max(32),
  signature_key: z.string().min(1).max(256),
  transaction_status: z.string().min(1).max(32),
  fraud_status: optionalField(32),
  transaction_id: optionalField(100),
  payment_type: optionalField(50),
});

/** Order IDs of the notifications sent by "Test notification URL" in the Midtrans dashboard. */
const TEST_ORDER_PREFIX = "payment_notif_test_";

export type WebhookResult = {
  httpStatus: number;
  result: string;
  /** Set when the order is paid after this delivery, so its emails can go out. */
  paidOrderId?: string;
};

/**
 * Handles a Midtrans HTTP notification.
 *
 * 1. Validate the shape, then the signature with the key of the account the
 *    order was paid into (403 when it is wrong). Unknown orders are checked
 *    against the platform account.
 * 2. Store the delivery under a key built from its contents; a delivery
 *    that was already processed returns 200 without doing anything.
 * 3. Fetch the authoritative status from the Status API and apply it.
 *    A provider outage returns 503 so Midtrans retries later.
 */
export async function handleMidtransNotification(
  db: Database,
  gatewayFor: (
    order: Order | null
  ) => PaymentGateway | null | Promise<PaymentGateway | null>,
  rawBody: string
): Promise<WebhookResult> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { httpStatus: 400, result: "invalid_json" };
  }
  const parsed = notificationSchema.safeParse(json);
  if (!parsed.success) {
    // Names the fields (never their values), so the log says what to fix.
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
    ].join(",");
    return { httpStatus: 400, result: `invalid_payload:${fields}` };
  }
  const payload: NotificationPayload = parsed.data;

  // The dashboard's test is for a transaction that does not exist: answer
  // 200 and store nothing. The signature result goes to the log, so a
  // MIDTRANS_SERVER_KEY from another account shows up here first.
  if (payload.order_id.startsWith(TEST_ORDER_PREFIX)) {
    const gateway = await gatewayFor(null);
    const signature = !gateway
      ? "no_server_key"
      : gateway.verifyNotification(payload)
        ? "signature_ok"
        : "signature_mismatch";
    return { httpStatus: 200, result: `test:${signature}` };
  }

  const order =
    (await db.query.orders.findFirst({
      where: eq(orders.code, payload.order_id),
    })) ?? null;
  const gateway = await gatewayFor(order);
  if (!gateway) return { httpStatus: 503, result: "payments_not_configured" };
  if (!gateway.verifyNotification(payload))
    return { httpStatus: 403, result: "invalid_signature" };

  const eventKey = sha256(
    [
      payload.order_id,
      payload.transaction_status,
      payload.status_code,
      payload.fraud_status ?? "",
      payload.transaction_id ?? "",
      payload.gross_amount,
    ].join("|")
  );

  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: gateway.provider,
      eventKey,
      orderCode: payload.order_id,
      payload: rawBody.slice(0, 20_000),
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });

  let webhookId = inserted[0]?.id;
  if (!webhookId) {
    const previous = await db.query.webhookEvents.findFirst({
      where: and(
        eq(webhookEvents.provider, gateway.provider),
        eq(webhookEvents.eventKey, eventKey)
      ),
    });
    // Only deliveries that failed part-way (no result, or an error) are processed again.
    if (previous?.result && !previous.result.startsWith("error:"))
      return { httpStatus: 200, result: "duplicate" };
    webhookId = previous?.id;
  }

  const finish = async (
    result: string,
    httpStatus = 200
  ): Promise<WebhookResult> => {
    if (webhookId)
      await db
        .update(webhookEvents)
        .set({ result })
        .where(eq(webhookEvents.id, webhookId));
    return { httpStatus, result };
  };

  if (!order) return finish("ignored:unknown_order");

  let status: GatewayStatus | null;
  try {
    status = await gateway.getStatus(order.code);
  } catch (error) {
    console.error("[webhook] status check failed", error);
    return finish("error:status_unavailable", 503);
  }
  if (!status) return finish("ignored:not_found_at_provider");

  const applied = await applyGatewayStatus(db, order, status);
  if (applied.outcome === "rejected") {
    console.error("[webhook] rejected", order.code, applied.reason);
    return finish(`rejected:${applied.reason}`);
  }
  const done = await finish(`${applied.outcome}:${applied.status}`);
  return applied.status === "paid" ? { ...done, paidOrderId: order.id } : done;
}

/**
 * Midtrans' recurring-payment notification URL. This site sells one-off
 * payments only, so nothing should arrive here. A charge notification still
 * goes through the normal handler (signature checked, unknown orders
 * ignored); anything else is acknowledged with 200 so Midtrans stops
 * retrying.
 */
export async function handleMidtransRecurringNotification(
  db: Database,
  gatewayFor: Parameters<typeof handleMidtransNotification>[1],
  rawBody: string
): Promise<WebhookResult> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { httpStatus: 400, result: "invalid_json" };
  }
  if (notificationSchema.safeParse(json).success)
    return handleMidtransNotification(db, gatewayFor, rawBody);
  return { httpStatus: 200, result: "ignored:not_a_payment" };
}

// ------------------------------------------------------------ buyer views

/** The products of an order, in the order they were bought, each with its download grant (once paid). */
export async function loadOrderLines(db: Database, orderId: string) {
  const rows = await db
    .select({
      item: orderItems,
      product: {
        slug: products.slug,
        coverUrl: products.coverUrl,
        deliveryType: products.deliveryType,
      },
      delivery: digitalDeliveries,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(
      digitalDeliveries,
      and(
        eq(digitalDeliveries.orderId, orderItems.orderId),
        eq(digitalDeliveries.productId, orderItems.productId)
      )
    )
    .where(eq(orderItems.orderId, orderId))
    // Inserted in one statement, so rowid keeps the order of the cart.
    .orderBy(sql`order_items.rowid`);
  return rows.map(({ item, product, delivery }) => ({
    productId: item.productId,
    name: item.productName,
    slug: product.slug,
    coverUrl: product.coverUrl,
    deliveryType: product.deliveryType,
    quantity: item.quantity,
    /** Line totals (price × quantity), before and after the discount code. */
    listAmount: item.listAmount ?? item.unitAmount,
    unitAmount: item.unitAmount,
    delivery,
  }));
}

export type OrderLine = Awaited<ReturnType<typeof loadOrderLines>>[number];

/** Finds an order by code and access token. Wrong token behaves like a missing order. */
export async function findOrderForBuyer(
  db: Database,
  code: string,
  token: string | null,
  /** The key from an order email (?k=), checked with AUTH_SECRET. */
  emailKey?: { key: string | null; secret: string }
) {
  const key = emailKey?.key ?? null;
  if ((!token || token.length > 200) && (!key || key.length > 200)) return null;
  const order = await db.query.orders.findFirst({
    where: eq(orders.code, code),
  });
  if (!order) return null;
  const allowed = token
    ? safeEqual(order.accessTokenHash, sha256(token))
    : key !== null &&
      emailKey !== undefined &&
      isOrderEmailKey(key, order.code, order.accessTokenHash, emailKey.secret);
  if (!allowed) return null;
  const [lines, profile] = await Promise.all([
    loadOrderLines(db, order.id),
    db.query.profiles.findFirst({
      where: eq(profiles.id, order.profileId),
      columns: { username: true, displayName: true, whatsappNumber: true },
    }),
  ]);
  return lines.length > 0 && profile ? { order, lines, profile } : null;
}

const STATUS_RECHECK_MS = 10_000;

/** Lets the buyer ask for a fresh status (e.g. after paying). Throttled per order. */
export async function refreshOrderStatus(
  db: Database,
  gateway: PaymentGateway,
  order: Order,
  nowMs = Date.now()
): Promise<OrderStatus> {
  if (order.status !== "pending") return order.status;
  const transaction = await db.query.paymentTransactions.findFirst({
    where: eq(paymentTransactions.orderId, order.id),
  });
  if (
    transaction?.statusCheckedAt &&
    nowMs - transaction.statusCheckedAt.getTime() < STATUS_RECHECK_MS
  ) {
    return order.status;
  }
  const status = await gateway.getStatus(order.code);
  if (!status) {
    await db
      .update(paymentTransactions)
      .set({ statusCheckedAt: new Date(nowMs) })
      .where(eq(paymentTransactions.orderId, order.id));
    return order.status;
  }
  const result = await applyGatewayStatus(db, order, status, nowMs);
  return result.outcome === "rejected" ? order.status : result.status;
}

// --------------------------------------------------------------- delivery

export const DOWNLOAD_LINK_TTL_MS = 15 * 60 * 1000;

export function signedDownloadPath(
  deliveryId: string,
  secret: string,
  nowMs = Date.now()
): string {
  const { exp, sig } = signExpiring(
    secret,
    `download:${deliveryId}`,
    nowMs + DOWNLOAD_LINK_TTL_MS
  );
  return `/api/download/${deliveryId}?exp=${exp}&sig=${sig}`;
}

export type DownloadGrant =
  | { ok: true; kind: "file"; fileKey: string; fileName: string }
  | { ok: true; kind: "link"; url: string }
  | {
      ok: false;
      reason:
        "not_found" | "not_paid" | "revoked" | "limit_reached" | "unavailable";
    };

/**
 * Checks that a delivery belongs to a paid order, then counts the download.
 * The count is incremented with a conditional UPDATE so parallel requests
 * cannot exceed the limit.
 */
export async function authorizeDownload(
  db: Database,
  deliveryId: string,
  nowMs = Date.now()
): Promise<DownloadGrant> {
  const delivery = await db.query.digitalDeliveries.findFirst({
    where: eq(digitalDeliveries.id, deliveryId),
  });
  if (!delivery) return { ok: false, reason: "not_found" };
  if (delivery.revokedAt) return { ok: false, reason: "revoked" };

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, delivery.orderId),
    columns: { status: true },
  });
  if (order?.status !== "paid") return { ok: false, reason: "not_paid" };

  const product = await db.query.products.findFirst({
    where: eq(products.id, delivery.productId),
  });
  if (!product) return { ok: false, reason: "unavailable" };

  const grant: DownloadGrant | null =
    product.deliveryType === "file" && product.deliveryFileKey
      ? {
          ok: true,
          kind: "file",
          fileKey: product.deliveryFileKey,
          fileName: product.deliveryFileName ?? "produk",
        }
      : product.deliveryType === "link" && product.deliveryUrl
        ? { ok: true, kind: "link", url: product.deliveryUrl }
        : null;
  if (!grant) return { ok: false, reason: "unavailable" };

  const counted = await db
    .update(digitalDeliveries)
    .set({
      downloadCount: sql`${digitalDeliveries.downloadCount} + 1`,
      lastAccessedAt: new Date(nowMs),
    })
    .where(
      and(
        eq(digitalDeliveries.id, deliveryId),
        sql`${digitalDeliveries.downloadCount} < ${digitalDeliveries.maxDownloads}`
      )
    )
    .returning({ id: digitalDeliveries.id });
  if (counted.length === 0) return { ok: false, reason: "limit_reached" };
  return grant;
}

// ------------------------------------------------------------------ admin

export const ORDERS_PAGE_SIZE = 20;

export async function listOrders(
  db: Database,
  profileId: string,
  options: {
    status?: OrderStatus | undefined;
    query?: string;
    page?: number;
  } = {}
) {
  const conditions: SQL[] = [eq(orders.profileId, profileId)];
  if (options.status) conditions.push(eq(orders.status, options.status));
  const query = options.query?.replace(/[%_]/g, "").trim().slice(0, 100);
  if (query) {
    const search = or(
      like(orders.code, `%${query}%`),
      like(orders.buyerEmail, `%${query}%`),
      like(orders.buyerName, `%${query}%`)
    );
    if (search) conditions.push(search);
  }
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const where = and(...conditions);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        order: orders,
        productName: products.name,
        /** Products in the order; the name above is the first one. */
        itemCount: sql<number>`(select count(*) from order_items where order_items.order_id = ${orders.id})`,
        transactionStatus: paymentTransactions.transactionStatus,
        paymentType: paymentTransactions.paymentType,
        // Summed over the order's products (one grant each).
        downloadCount: sql<
          number | null
        >`(select sum(download_count) from digital_deliveries where digital_deliveries.order_id = ${orders.id})`,
        maxDownloads: sql<
          number | null
        >`(select sum(max_downloads) from digital_deliveries where digital_deliveries.order_id = ${orders.id})`,
      })
      .from(orders)
      .innerJoin(products, eq(products.id, orders.productId))
      .leftJoin(paymentTransactions, eq(paymentTransactions.orderId, orders.id))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(ORDERS_PAGE_SIZE)
      .offset((page - 1) * ORDERS_PAGE_SIZE),
    db.select({ value: count() }).from(orders).where(where),
  ]);
  const totalCount = total?.value ?? 0;
  return {
    rows,
    total: totalCount,
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / ORDERS_PAGE_SIZE)),
  };
}

/** Issues a new buyer access link (the old one stops working). Owner only. */
export async function rotateOrderAccess(
  db: Database,
  profileId: string,
  orderId: string,
  siteUrl: string
): Promise<Result<{ url: string }>> {
  const token = randomToken();
  const [row] = await db
    .update(orders)
    .set({ accessTokenHash: sha256(token) })
    .where(and(eq(orders.id, orderId), eq(orders.profileId, profileId)))
    .returning({ code: orders.code });
  return row
    ? ok({ url: orderAccessUrl(siteUrl, row.code, token) })
    : fail("Pesanan tidak ditemukan.");
}
