import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  orderItems,
  orders,
  paymentTransactions,
  products,
  profiles,
  users,
} from "@/db/schema";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { accentHex } from "@/lib/profile-look";

import { orderEmailKey } from "../order-access";
import type { EmailMessage, SendEmail } from "./resend";
import {
  fromHeader,
  paymentLinkEmail,
  receiptEmail,
  sellerOrderEmail,
} from "./templates";

/**
 * Which order emails are due, and sending each exactly once:
 * - the buyer's payment link, right after checkout;
 * - the buyer's receipt (invoice and product link) and the seller's notice,
 *   once the order is paid.
 * Each send first claims its timestamp column on the order, so parallel
 * triggers (webhook retries, the order page) cannot send twice; a failed
 * send gives the claim back so a later trigger retries.
 */

export type EmailDeps = {
  send: SendEmail;
  /** Verified sender address, e.g. pesanan@domain-anda.id. */
  fromAddress: string;
  siteUrl: string;
  /** AUTH_SECRET, for the order links in the emails. */
  secret: string;
};

type EmailColumn =
  "paymentLinkEmailedAt" | "receiptEmailedAt" | "sellerEmailedAt";

export type SendOutcome = "sent" | "skipped" | "failed";

async function sendOnce(
  db: Database,
  orderId: string,
  column: EmailColumn,
  message: EmailMessage,
  send: SendEmail,
  nowMs: number
): Promise<SendOutcome> {
  const claimed = await db
    .update(orders)
    .set({ [column]: new Date(nowMs) })
    .where(and(eq(orders.id, orderId), isNull(orders[column])))
    .returning({ id: orders.id });
  if (claimed.length === 0) return "skipped";
  try {
    await send(message);
    return "sent";
  } catch (error) {
    await db
      .update(orders)
      .set({ [column]: null })
      .where(eq(orders.id, orderId));
    console.error(`[email] ${column} for order ${orderId} failed`, error);
    return "failed";
  }
}

async function loadOrder(db: Database, orderId: string) {
  const [row] = await db
    .select({
      order: orders,
      productName: products.name,
      deliveryType: products.deliveryType,
      sellerName: profiles.displayName,
      accent: profiles.accent,
      ownerEmail: users.email,
      listAmount: orderItems.listAmount,
      paymentType: paymentTransactions.paymentType,
    })
    .from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .innerJoin(profiles, eq(profiles.id, orders.profileId))
    .innerJoin(users, eq(users.id, profiles.ownerId))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(paymentTransactions, eq(paymentTransactions.orderId, orders.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return null;
  const settings = await db.query.platformSettings.findFirst({
    columns: { brandName: true },
  });
  return { ...row, brandName: settings?.brandName ?? "Adhi Web Services" };
}

function orderLinks(
  deps: EmailDeps,
  order: { code: string; accessTokenHash: string }
) {
  const key = encodeURIComponent(
    orderEmailKey(order.code, order.accessTokenHash, deps.secret)
  );
  const base = `${deps.siteUrl}/pesanan/${encodeURIComponent(order.code)}`;
  return { order: `${base}?k=${key}`, invoice: `${base}/invoice?k=${key}` };
}

/** Sent right after checkout, while the order waits for payment. */
export async function sendPaymentLinkEmail(
  db: Database,
  orderId: string,
  deps: EmailDeps,
  nowMs = Date.now()
): Promise<SendOutcome> {
  const loaded = await loadOrder(db, orderId);
  if (!loaded || loaded.order.status !== "pending") return "skipped";
  const { order } = loaded;
  const content = paymentLinkEmail({
    sellerName: loaded.sellerName,
    brandName: loaded.brandName,
    accent: accentHex(loaded.accent),
    buyerName: order.buyerName,
    orderCode: order.code,
    productName: loaded.productName,
    total: order.amount,
    orderUrl: orderLinks(deps, order).order,
  });
  return sendOnce(
    db,
    order.id,
    "paymentLinkEmailedAt",
    {
      ...content,
      from: fromHeader(loaded.sellerName, deps.fromAddress),
      to: order.buyerEmail,
      idempotencyKey: `payment-link/${order.id}`,
    },
    deps.send,
    nowMs
  );
}

/** The buyer's receipt and the seller's notice, once the order is paid. Safe to call again. */
export async function deliverOrderEmails(
  db: Database,
  orderId: string,
  deps: EmailDeps,
  nowMs = Date.now()
): Promise<{ receipt: SendOutcome; seller: SendOutcome }> {
  const loaded = await loadOrder(db, orderId);
  if (!loaded || loaded.order.status !== "paid")
    return { receipt: "skipped", seller: "skipped" };
  const { order } = loaded;
  const paidAt = order.paidAt ?? new Date(nowMs);
  const paymentMethod = paymentMethodLabel(loaded.paymentType);
  const hasDelivery = loaded.deliveryType !== "none";
  const links = orderLinks(deps, order);

  const receipt =
    order.receiptEmailedAt === null
      ? await sendOnce(
          db,
          order.id,
          "receiptEmailedAt",
          {
            ...receiptEmail({
              sellerName: loaded.sellerName,
              brandName: loaded.brandName,
              accent: accentHex(loaded.accent),
              buyerName: order.buyerName,
              orderCode: order.code,
              productName: loaded.productName,
              listAmount:
                loaded.listAmount ?? order.amount + order.discountAmount,
              discountCode: order.discountCode,
              discountAmount: order.discountAmount,
              total: order.amount,
              paidAt,
              paymentMethod,
              orderUrl: links.order,
              invoiceUrl: links.invoice,
              hasDelivery,
            }),
            from: fromHeader(loaded.sellerName, deps.fromAddress),
            to: order.buyerEmail,
            idempotencyKey: `receipt/${order.id}`,
          },
          deps.send,
          nowMs
        )
      : "skipped";

  const seller =
    order.sellerEmailedAt === null
      ? await sendOnce(
          db,
          order.id,
          "sellerEmailedAt",
          {
            ...sellerOrderEmail({
              brandName: loaded.brandName,
              sellerName: loaded.sellerName,
              orderCode: order.code,
              productName: loaded.productName,
              total: order.amount,
              buyerName: order.buyerName,
              buyerEmail: order.buyerEmail,
              buyerPhone: order.buyerPhone,
              paidAt,
              paymentMethod,
              dashboardUrl: `${deps.siteUrl}/admin/orders?q=${encodeURIComponent(order.code)}`,
              hasDelivery,
            }),
            from: fromHeader(loaded.brandName, deps.fromAddress),
            to: loaded.ownerEmail,
            idempotencyKey: `seller/${order.id}`,
          },
          deps.send,
          nowMs
        )
      : "skipped";

  return { receipt, seller };
}
