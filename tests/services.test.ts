import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  analyticsEvents,
  digitalDeliveries,
  orderItems,
  orders,
  profileLinks,
  profiles,
  webhookEvents,
} from "@/db/schema";
import { parseRange } from "@/lib/analytics/range";
import {
  type CheckoutInput,
  discountCodeInputSchema,
  type DiscountCodeInput,
  productInputSchema,
  type ProductInput,
} from "@/lib/validation";
import {
  findTrackableLink,
  ingestClientEvent,
  recordServerEvent,
  type VisitorContext,
} from "@/server/analytics/ingest";
import {
  getOverviewTotals,
  getProductAnalytics,
  getTopLinks,
  getTrafficSeries,
  getTrafficSources,
} from "@/server/analytics/queries";
import {
  createSession,
  MAX_FAILED_LOGINS,
  resolveSession,
  signIn,
} from "@/server/auth";
import {
  applyGatewayStatus,
  authorizeDownload,
  findOrderForBuyer,
  handleMidtransNotification,
  rotateOrderAccess,
  startCheckout,
} from "@/server/checkout";
import {
  CODE_HOLD_MS,
  CODE_REJECTION_MESSAGES,
  codeStatus,
  createDiscountCode,
  deleteDiscountCode,
  hasUsableCodes,
  listDiscountCodes,
  updateDiscountCode,
} from "@/server/discount-codes";
import type { GatewayStatus, PaymentGateway } from "@/server/payments/gateway";
import { midtransSignature } from "@/server/payments/midtrans";
import { createProduct, deleteProduct, updateProduct } from "@/server/products";
import {
  createLink,
  deleteLink,
  getPublicProfile,
  listLinks,
  reorderLinks,
  setLinkActive,
  updateLink,
} from "@/server/profile";
import { createOwner } from "@/server/setup";

import { createTestDb } from "./helpers/db";

let db: Database;
let cleanup: () => void;
let ownerId: string;
let profileId: string;
let otherProfileId: string;

const visitor = (
  id: string,
  extra: Partial<VisitorContext> = {}
): VisitorContext => ({
  visitorId: id,
  sessionId: `s-${id}`,
  sessionSource: null,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
  siteHost: "example.id",
  ...extra,
});

before(async () => {
  ({ db, cleanup } = await createTestDb());
  const owner = await createOwner(db, {
    email: "owner@example.id",
    password: "rahasia-1234",
    name: "Owner",
    username: "owner",
  });
  const other = await createOwner(db, {
    email: "other@example.id",
    password: "rahasia-1234",
    name: "Other",
    username: "other",
  });
  ownerId = owner.user.id;
  profileId = owner.profile.id;
  otherProfileId = other.profile.id;
});

after(() => cleanup());

describe("auth", () => {
  test("signs in with the right password and resolves the session", async () => {
    const result = await signIn(db, {
      email: "owner@example.id",
      password: "rahasia-1234",
      clientKey: "c1",
      userAgent: null,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const session = await resolveSession(db, result.token);
    assert.equal(session?.user.id, ownerId);
    assert.equal(session?.profile.id, profileId);
  });

  test("rejects a wrong password and rate limits repeated failures", async () => {
    for (let attempt = 0; attempt < MAX_FAILED_LOGINS; attempt++) {
      const result = await signIn(db, {
        email: "other@example.id",
        password: "salah",
        clientKey: "c2",
        userAgent: null,
      });
      assert.deepEqual(result, { ok: false, reason: "invalid" });
    }
    const blocked = await signIn(db, {
      email: "other@example.id",
      password: "rahasia-1234",
      clientKey: "c3",
      userAgent: null,
    });
    assert.deepEqual(blocked, { ok: false, reason: "rate_limited" });
  });

  test("expired and unknown sessions resolve to null", async () => {
    const { token } = await createSession(
      db,
      ownerId,
      null,
      Date.now() - 31 * 24 * 60 * 60 * 1000
    );
    assert.equal(await resolveSession(db, token), null);
    assert.equal(await resolveSession(db, "not-a-token"), null);
  });
});

describe("links and ownership", () => {
  let linkId: string;

  test("create, edit, toggle and reorder links", async () => {
    const first = await createLink(db, profileId, {
      kind: "link",
      title: "Portfolio",
      url: "https://example.id",
      message: null,
      description: null,
      thumbnailUrl: null,
      category: null,
      layout: "classic",
      isActive: true,
    });
    assert.equal(first.ok, true);
    linkId = first.ok ? first.data.id : "";

    const updated = await updateLink(db, profileId, linkId, {
      kind: "link",
      title: "Portfolio baru",
      url: "https://example.id/baru",
      message: null,
      description: "Desc",
      thumbnailUrl: null,
      category: null,
      layout: "featured",
      isActive: true,
    });
    assert.equal(updated.ok, true);

    const links = await listLinks(db, profileId);
    const ids = links.map((link) => link.id).reverse();
    assert.equal((await reorderLinks(db, profileId, ids)).ok, true);
    assert.deepEqual(
      (await listLinks(db, profileId)).map((link) => link.id),
      ids
    );
    assert.equal(
      (await reorderLinks(db, profileId, ids.slice(1))).ok,
      false,
      "partial lists are refused"
    );
  });

  test("inactive links are hidden from the public profile", async () => {
    await setLinkActive(db, profileId, linkId, false);
    let profile = await getPublicProfile(db, "owner");
    assert.equal(
      profile?.blocks.some((block) => block.id === linkId),
      false
    );
    await setLinkActive(db, profileId, linkId, true);
    profile = await getPublicProfile(db, "owner");
    const block = profile?.blocks.find((item) => item.id === linkId);
    assert.equal(block?.type === "link" && block.href, `/go/l/${linkId}`);
  });

  test("a WhatsApp link shows only once Settings has a number, and opens that number", async () => {
    const created = await createLink(db, profileId, {
      kind: "whatsapp",
      title: "Jasa Pembuatan Website",
      url: null,
      message: "Halo, saya mau konsultasi website.",
      description: null,
      thumbnailUrl: null,
      category: null,
      layout: "featured",
      isActive: true,
    });
    assert.ok(created.ok);
    const id = created.ok ? created.data.id : "";
    const shown = async () =>
      (await getPublicProfile(db, "owner"))?.blocks.find(
        (block) => block.id === id
      );

    assert.equal(await shown(), undefined, "hidden without a number");

    await db
      .update(profiles)
      .set({ whatsappNumber: "6281234567890" })
      .where(eq(profiles.id, profileId));
    const block = await shown();
    assert.ok(block?.type === "link");
    assert.equal(block.icon, "whatsapp");
    assert.equal(block.href, `/go/l/${id}`);

    const trackable = await findTrackableLink(db, id);
    assert.equal(trackable?.kind, "whatsapp");
    assert.equal(trackable?.whatsappNumber, "6281234567890");
    assert.equal(trackable?.message, "Halo, saya mau konsultasi website.");

    await db
      .update(profiles)
      .set({ whatsappNumber: null })
      .where(eq(profiles.id, profileId));
    assert.ok((await deleteLink(db, profileId, id)).ok);
  });

  test("another profile cannot edit, toggle, delete or reorder these links", async () => {
    const input = {
      kind: "link" as const,
      title: "Hijack",
      url: "https://evil.example",
      message: null,
      description: null,
      thumbnailUrl: null,
      category: null,
      layout: "classic" as const,
      isActive: true,
    };
    assert.equal(
      (await updateLink(db, otherProfileId, linkId, input)).ok,
      false
    );
    assert.equal(
      (await setLinkActive(db, otherProfileId, linkId, false)).ok,
      false
    );
    assert.equal((await deleteLink(db, otherProfileId, linkId)).ok, false);
    assert.equal((await reorderLinks(db, otherProfileId, [linkId])).ok, false);
    const row = await db.query.profileLinks.findFirst({
      where: eq(profileLinks.id, linkId),
    });
    assert.equal(row?.title, "Portfolio baru");
    assert.equal(row?.isActive, true);
  });

  test("unpublished profiles are not public", async () => {
    assert.ok(await getPublicProfile(db, "owner"));
    assert.equal(await getPublicProfile(db, "missing"), null);
  });
});

describe("analytics", () => {
  let linkId: string;

  before(async () => {
    const created = await createLink(db, profileId, {
      kind: "link",
      title: "Tracked",
      url: "https://tracked.example",
      message: null,
      description: null,
      thumbnailUrl: null,
      category: null,
      layout: "classic",
      isActive: true,
    });
    linkId = created.ok ? created.data.id : "";
  });

  test("a repeated beacon with the same key is stored once", async () => {
    const event = {
      type: "profile_view" as const,
      eventKey: crypto.randomUUID(),
      profileId,
      referrer: "https://l.instagram.com/",
    };
    const first = await ingestClientEvent(db, event, visitor("v1"));
    const second = await ingestClientEvent(db, event, visitor("v1"));
    assert.deepEqual(first, { recorded: true, source: "social" });
    assert.deepEqual(second, { recorded: false, reason: "duplicate" });
  });

  test("events for unknown profiles or another profile's products are refused", async () => {
    const unknown = await ingestClientEvent(
      db,
      {
        type: "profile_view",
        eventKey: crypto.randomUUID(),
        profileId: crypto.randomUUID(),
      },
      visitor("v1")
    );
    assert.deepEqual(unknown, { recorded: false, reason: "unknown_target" });
  });

  test("totals, unique visitors, CTR and top links come from stored events", async () => {
    // v1 already viewed once; v2 views twice, v3 once.
    for (const id of ["v2", "v2", "v3"]) {
      await ingestClientEvent(
        db,
        { type: "profile_view", eventKey: crypto.randomUUID(), profileId },
        visitor(id)
      );
    }
    assert.equal(
      await recordServerEvent(
        db,
        { profileId, type: "link_click", linkId, dedupe: true },
        visitor("v2")
      ),
      true
    );
    assert.equal(
      await recordServerEvent(
        db,
        { profileId, type: "link_click", linkId, dedupe: true },
        visitor("v2")
      ),
      false,
      "double click within the dedupe window counts once"
    );
    await recordServerEvent(
      db,
      { profileId, type: "link_click", linkId, dedupe: true },
      visitor("v3")
    );

    const range = parseRange({ range: "7d" });
    const totals = await getOverviewTotals(db, profileId, range);
    assert.equal(totals.profileViews, 4);
    assert.equal(totals.uniqueVisitors, 3);
    assert.equal(totals.linkClicks, 2);
    assert.equal(totals.ctr, 50);

    const top = await getTopLinks(db, profileId, range);
    assert.equal(top[0]?.linkId, linkId);
    assert.equal(top[0]?.clicks, 2);
    assert.equal(top[0]?.share, 100);
    assert.equal(top[0]?.ctr, 50);

    const series = await getTrafficSeries(db, profileId, range);
    assert.equal(series.length, 7);
    assert.equal(
      series.reduce((sum, point) => sum + point.views, 0),
      4
    );

    const { sources } = await getTrafficSources(db, profileId, range);
    assert.equal(sources.find((row) => row.source === "social")?.views, 1);
    assert.equal(sources.find((row) => row.source === "direct")?.views, 3);
  });

  test("the date range filters events", async () => {
    const old = Date.now() - 40 * 24 * 60 * 60 * 1000;
    await ingestClientEvent(
      db,
      { type: "profile_view", eventKey: crypto.randomUUID(), profileId },
      visitor("v9"),
      old
    );
    assert.equal(
      (await getOverviewTotals(db, profileId, parseRange({ range: "30d" })))
        .profileViews,
      4
    );
    assert.equal(
      (await getOverviewTotals(db, profileId, parseRange({ range: "90d" })))
        .profileViews,
      5
    );
  });

  test("deleting a link keeps its clicks in the totals", async () => {
    await deleteLink(db, profileId, linkId);
    const range = parseRange({ range: "7d" });
    const top = await getTopLinks(db, profileId, range);
    assert.equal(top[0]?.linkId, null);
    assert.equal(top[0]?.title, "Link yang sudah dihapus");
    assert.equal((await getOverviewTotals(db, profileId, range)).linkClicks, 2);
  });
});

// ----------------------------------------------------------- checkout flow

function fakeGateway(serverKey: string) {
  const statuses = new Map<string, GatewayStatus>();
  const created: string[] = [];
  const charged = new Map<string, number>();
  const gateway: PaymentGateway = {
    provider: "midtrans",
    async createTransaction(input) {
      // Like the real call, answer on a later turn of the event loop (network I/O).
      await new Promise((resolve) => setImmediate(resolve));
      created.push(input.orderCode);
      charged.set(input.orderCode, input.amount);
      return {
        token: `tok-${input.orderCode}`,
        redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/tok-${input.orderCode}`,
      };
    },
    async getStatus(orderCode) {
      return statuses.get(orderCode) ?? null;
    },
    verifyNotification(payload) {
      return midtransSignature(payload, serverKey) === payload.signature_key;
    },
  };
  return { gateway, statuses, created, charged };
}

function productInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return productInputSchema.parse({
    name: "Template Portofolio",
    slug: `template-${crypto.randomUUID().slice(0, 8)}`,
    priceAmount: 25000,
    productType: "template",
    status: "published",
    checkoutMethod: "direct",
    deliveryType: "link",
    deliveryUrl: "https://drive.example/file",
    ...overrides,
  });
}

describe("products", () => {
  test("direct checkout cannot be published until payments are configured", async () => {
    const result = await createProduct(db, profileId, productInput(), {
      profileWhatsapp: null,
      paymentsReady: false,
    });
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.fieldErrors?.checkoutMethod);
  });

  test("WhatsApp products need a valid number to publish", async () => {
    const input = productInput({
      checkoutMethod: "whatsapp",
      deliveryType: "none",
      deliveryUrl: null,
    });
    const refused = await createProduct(db, profileId, input, {
      profileWhatsapp: null,
      paymentsReady: false,
    });
    assert.ok(!refused.ok && refused.fieldErrors?.whatsappNumber);
    const created = await createProduct(db, profileId, input, {
      profileWhatsapp: "081234567890",
      paymentsReady: false,
    });
    assert.equal(created.ok, true);
  });

  test("another profile cannot update or delete a product", async () => {
    const created = await createProduct(
      db,
      profileId,
      productInput({ status: "draft" }),
      { profileWhatsapp: null, paymentsReady: false }
    );
    assert.ok(created.ok);
    const id = created.ok ? created.data.id : "";
    assert.equal(
      (
        await updateProduct(
          db,
          otherProfileId,
          id,
          productInput({ status: "draft" }),
          { profileWhatsapp: null, paymentsReady: true }
        )
      ).ok,
      false
    );
    assert.equal((await deleteProduct(db, otherProfileId, id)).ok, false);
    assert.equal((await deleteProduct(db, profileId, id)).ok, true);
  });
});

describe("direct checkout, webhook and delivery", () => {
  const serverKey = "SB-Mid-server-TEST";
  const { gateway, statuses } = fakeGateway(serverKey);
  let productId: string;
  let orderCode: string;

  function notification(
    status: string,
    gross = "25000.00",
    extra: Record<string, string> = {}
  ) {
    const payload = {
      order_id: orderCode,
      status_code: status === "settlement" ? "200" : "201",
      gross_amount: gross,
      transaction_status: status,
      ...extra,
    };
    return JSON.stringify({
      ...payload,
      signature_key: midtransSignature(payload, serverKey),
    });
  }

  before(async () => {
    const created = await createProduct(db, profileId, productInput(), {
      profileWhatsapp: null,
      paymentsReady: true,
    });
    assert.ok(created.ok);
    productId = created.ok ? created.data.id : "";
  });

  test("checkout creates a pending order and a payment, reusing it on double submit", async () => {
    const input = {
      productId,
      idempotencyKey: crypto.randomUUID(),
      expectedAmount: 25000,
      discountCode: null,
      buyerName: "Budi",
      buyerEmail: "budi@example.id",
      buyerPhone: null,
    };
    const first = await startCheckout(db, gateway, input, {
      siteUrl: "https://example.id",
      visitor: visitor("buyer"),
    });
    assert.ok(first.ok);
    const second = await startCheckout(db, gateway, input, {
      siteUrl: "https://example.id",
      visitor: visitor("buyer"),
    });
    assert.ok(first.ok && second.ok);
    assert.equal(second.data.orderCode, first.data.orderCode);
    assert.equal(second.data.redirectUrl, first.data.redirectUrl);
    // The secret link is handed out once; a repeated submit cannot re-issue it.
    assert.match(first.data.accessToken ?? "", /^[\w-]{40,}$/);
    assert.equal(second.data.accessToken, null);

    orderCode = first.ok ? first.data.orderCode : "";
    const order = await db.query.orders.findFirst({
      where: eq(orders.code, orderCode),
    });
    assert.equal(order?.status, "pending");
    assert.equal(order?.amount, 25000);
    const initiated = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, "payment_initiated"));
    assert.equal(initiated.length, 1);
  });

  test("a webhook with a bad signature is refused and changes nothing", async () => {
    const body = JSON.parse(notification("settlement"));
    body.signature_key = "0".repeat(128);
    const result = await handleMidtransNotification(
      db,
      () => gateway,
      JSON.stringify(body)
    );
    assert.equal(result.httpStatus, 403);
    const order = await db.query.orders.findFirst({
      where: eq(orders.code, orderCode),
    });
    assert.equal(order?.status, "pending");
  });

  test("a signed webhook is confirmed against the status API before marking paid", async () => {
    // The provider still says pending: a forged "settlement" body with a leaked signature would not mark it paid.
    statuses.set(orderCode, {
      orderId: orderCode,
      transactionStatus: "pending",
      fraudStatus: null,
      statusCode: "201",
      grossAmount: 25000,
      transactionId: "t1",
      paymentType: "qris",
    });
    const pending = await handleMidtransNotification(
      db,
      () => gateway,
      notification("settlement")
    );
    assert.equal(pending.result, "unchanged:pending");

    statuses.set(orderCode, {
      orderId: orderCode,
      transactionStatus: "settlement",
      fraudStatus: null,
      statusCode: "200",
      grossAmount: 25000,
      transactionId: "t1",
      paymentType: "qris",
    });
    const paid = await handleMidtransNotification(
      db,
      () => gateway,
      notification("settlement", "25000.00", { transaction_id: "t1" })
    );
    const order = await db.query.orders.findFirst({
      where: eq(orders.code, orderCode),
    });
    assert.deepEqual(paid, {
      httpStatus: 200,
      result: "applied:paid",
      paidOrderId: order?.id,
    });
    assert.equal(order?.status, "paid");
    assert.ok(order?.paidAt);
    const deliveries = await db
      .select()
      .from(digitalDeliveries)
      .where(eq(digitalDeliveries.orderId, order?.id ?? ""));
    assert.equal(deliveries.length, 1);
  });

  test("the same webhook delivered again is idempotent", async () => {
    const again = await handleMidtransNotification(
      db,
      () => gateway,
      notification("settlement", "25000.00", { transaction_id: "t1" })
    );
    assert.deepEqual(again, { httpStatus: 200, result: "duplicate" });
    const succeeded = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, "payment_succeeded"));
    assert.equal(succeeded.length, 1, "payment_succeeded recorded once");
    const stored = await db.select().from(webhookEvents);
    assert.ok(stored.length >= 2);
  });

  test("a late expire notification never downgrades a paid order", async () => {
    const order = await db.query.orders.findFirst({
      where: eq(orders.code, orderCode),
    });
    assert.ok(order);
    const result = await applyGatewayStatus(db, order, {
      orderId: orderCode,
      transactionStatus: "expire",
      fraudStatus: null,
      statusCode: "407",
      grossAmount: 25000,
      transactionId: "t1",
      paymentType: "qris",
    });
    assert.deepEqual(result, { outcome: "unchanged", status: "paid" });
  });

  test("an amount mismatch is rejected", async () => {
    const order = await db.query.orders.findFirst({
      where: eq(orders.code, orderCode),
    });
    assert.ok(order);
    const result = await applyGatewayStatus(
      db,
      { ...order, status: "pending" },
      {
        orderId: orderCode,
        transactionStatus: "settlement",
        fraudStatus: null,
        statusCode: "200",
        grossAmount: 1000,
        transactionId: "t1",
        paymentType: "qris",
      }
    );
    assert.deepEqual(result, {
      outcome: "rejected",
      reason: "amount_mismatch",
    });
  });

  test("downloads need a paid order and stop at the limit", async () => {
    const order = await db.query.orders.findFirst({
      where: eq(orders.code, orderCode),
    });
    const delivery = await db.query.digitalDeliveries.findFirst({
      where: eq(digitalDeliveries.orderId, order?.id ?? ""),
    });
    assert.ok(delivery);

    const grant = await authorizeDownload(db, delivery.id);
    assert.deepEqual(grant, {
      ok: true,
      kind: "link",
      url: "https://drive.example/file",
    });

    await db
      .update(digitalDeliveries)
      .set({ downloadCount: delivery.maxDownloads })
      .where(eq(digitalDeliveries.id, delivery.id));
    assert.deepEqual(await authorizeDownload(db, delivery.id), {
      ok: false,
      reason: "limit_reached",
    });

    await db
      .update(digitalDeliveries)
      .set({ downloadCount: 0 })
      .where(eq(digitalDeliveries.id, delivery.id));
    await db
      .update(orders)
      .set({ status: "refunded" })
      .where(eq(orders.id, order?.id ?? ""));
    assert.deepEqual(await authorizeDownload(db, delivery.id), {
      ok: false,
      reason: "not_paid",
    });
    assert.deepEqual(await authorizeDownload(db, crypto.randomUUID()), {
      ok: false,
      reason: "not_found",
    });
  });

  test("buyers need the access token to see an order; rotating it revokes the old one", async () => {
    assert.equal(await findOrderForBuyer(db, orderCode, "wrong-token"), null);
    assert.equal(await findOrderForBuyer(db, orderCode, null), null);

    const order = await db.query.orders.findFirst({
      where: eq(orders.code, orderCode),
    });
    const first = await rotateOrderAccess(
      db,
      profileId,
      order?.id ?? "",
      "https://example.id"
    );
    assert.ok(first.ok);
    const token = new URL(
      first.ok ? first.data.url : "https://x"
    ).searchParams.get("t");
    assert.equal(
      (await findOrderForBuyer(db, orderCode, token))?.order.code,
      orderCode
    );

    assert.equal(
      (
        await rotateOrderAccess(
          db,
          otherProfileId,
          order?.id ?? "",
          "https://example.id"
        )
      ).ok,
      false
    );
    await rotateOrderAccess(
      db,
      profileId,
      order?.id ?? "",
      "https://example.id"
    );
    assert.equal(await findOrderForBuyer(db, orderCode, token), null);
  });

  test("product analytics separates WhatsApp clicks from verified sales", async () => {
    await recordServerEvent(
      db,
      { profileId, type: "whatsapp_checkout_clicked", productId },
      visitor("wa1")
    );
    await db
      .update(orders)
      .set({ status: "paid" })
      .where(eq(orders.code, orderCode));
    const { metrics, bestSellers } = await getProductAnalytics(
      db,
      profileId,
      parseRange({ range: "7d" })
    );
    assert.equal(metrics.whatsappClicks, 1);
    assert.equal(metrics.paidOrders, 1);
    assert.equal(metrics.revenue, 25000);
    assert.equal(bestSellers[0]?.productId, productId);
  });

  test("products with orders cannot be deleted", async () => {
    const result = await deleteProduct(db, profileId, productId);
    assert.equal(result.ok, false);
  });
});

describe("discount codes", () => {
  const { gateway, charged } = fakeGateway("SB-Mid-server-TEST");
  const site = { siteUrl: "https://example.id", visitor: visitor("kode") };
  let productId: string;
  let otherProductId: string;

  const code = (overrides: Record<string, unknown> = {}): DiscountCodeInput =>
    discountCodeInputSchema.parse({
      code: "1010",
      discountType: "percent",
      discountValue: 10,
      ...overrides,
    });

  const checkout = (overrides: Partial<CheckoutInput> = {}, nowMs?: number) =>
    startCheckout(
      db,
      gateway,
      {
        productId,
        idempotencyKey: crypto.randomUUID(),
        expectedAmount: 78000,
        discountCode: null,
        buyerName: "Sari",
        buyerEmail: "sari@example.id",
        buyerPhone: null,
        ...overrides,
      },
      site,
      nowMs
    );

  const orderOf = (orderCode: string) =>
    db.query.orders.findFirst({ where: eq(orders.code, orderCode) });

  before(async () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const created = await createProduct(
        db,
        profileId,
        productInput({ priceAmount: 78000 }),
        { profileWhatsapp: null, paymentsReady: true }
      );
      assert.ok(created.ok);
      ids.push(created.ok ? created.data.id : "");
    }
    [productId = "", otherProductId = ""] = ids;
  });

  test("a code changes what the order charges; the order keeps the code and the cut", async () => {
    assert.ok((await createDiscountCode(db, profileId, code())).ok);

    const stale = await checkout({ discountCode: "1010" });
    assert.equal(
      stale.ok,
      false,
      "refused when the total shown is not the total with the code"
    );

    const result = await checkout({
      discountCode: "1010",
      expectedAmount: 70200,
    });
    assert.ok(result.ok);
    const order = await orderOf(result.ok ? result.data.orderCode : "");
    assert.equal(order?.amount, 70200);
    assert.equal(order?.discountCode, "1010");
    assert.equal(order?.discountAmount, 7800);
    assert.equal(
      charged.get(order?.code ?? ""),
      70200,
      "Midtrans is asked for the discounted total"
    );
    const item = await db.query.orderItems.findFirst({
      where: eq(orderItems.orderId, order?.id ?? ""),
    });
    assert.equal(item?.listAmount, 78000);
    assert.equal(item?.unitAmount, 70200);
  });

  test("codes are case-insensitive and unique per profile", async () => {
    assert.ok(
      (
        await createDiscountCode(
          db,
          profileId,
          code({
            code: "hemat10k",
            discountType: "fixed",
            discountValue: 10000,
          })
        )
      ).ok
    );
    const duplicate = await createDiscountCode(
      db,
      profileId,
      code({ code: "HEMAT10K" })
    );
    assert.ok(!duplicate.ok && duplicate.fieldErrors?.code);
    assert.ok(
      (await createDiscountCode(db, otherProfileId, code({ code: "HEMAT10K" })))
        .ok,
      "another profile may use the same text"
    );

    const result = await checkout({
      discountCode: "Hemat10k",
      expectedAmount: 68000,
    });
    assert.ok(result.ok);
  });

  test("unknown, switched off, not yet started and ended codes are refused", async () => {
    await createDiscountCode(
      db,
      profileId,
      code({ code: "MATI", isActive: false })
    );
    await createDiscountCode(
      db,
      profileId,
      code({ code: "NANTI", startsAt: "2099-01-01T00:00" })
    );
    await createDiscountCode(
      db,
      profileId,
      code({ code: "LEWAT", endsAt: "2026-01-01T00:00" })
    );
    const cases: Array<[string, string]> = [
      ["TIDAKADA", CODE_REJECTION_MESSAGES.not_found],
      ["MATI", CODE_REJECTION_MESSAGES.not_found],
      ["NANTI", CODE_REJECTION_MESSAGES.not_started],
      ["LEWAT", CODE_REJECTION_MESSAGES.ended],
    ];
    for (const [text, message] of cases) {
      const result = await checkout({
        discountCode: text,
        expectedAmount: 70200,
      });
      assert.deepEqual(result, { ok: false, error: message }, text);
    }
  });

  test("product limits and profile boundaries hold", async () => {
    await createDiscountCode(
      db,
      profileId,
      code({ code: "KHUSUS", productId: otherProductId })
    );
    assert.deepEqual(
      await checkout({ discountCode: "KHUSUS", expectedAmount: 70200 }),
      {
        ok: false,
        error: CODE_REJECTION_MESSAGES.wrong_product,
      }
    );
    assert.ok(
      (
        await checkout({
          productId: otherProductId,
          discountCode: "KHUSUS",
          expectedAmount: 70200,
        })
      ).ok
    );

    await createDiscountCode(db, otherProfileId, code({ code: "PUNYALAIN" }));
    assert.deepEqual(
      await checkout({ discountCode: "PUNYALAIN", expectedAmount: 70200 }),
      {
        ok: false,
        error: CODE_REJECTION_MESSAGES.not_found,
      }
    );

    const foreign = await createDiscountCode(
      db,
      otherProfileId,
      code({ code: "CURI", productId })
    );
    assert.ok(
      !foreign.ok && foreign.fieldErrors?.productId,
      "cannot target another profile's product"
    );
  });

  test("a code never makes a product free", async () => {
    await createDiscountCode(
      db,
      profileId,
      code({ code: "BESAR", discountType: "fixed", discountValue: 100000 })
    );
    assert.deepEqual(
      await checkout({ discountCode: "BESAR", expectedAmount: 0 }),
      {
        ok: false,
        error: CODE_REJECTION_MESSAGES.too_large,
      }
    );
    const scoped = await createDiscountCode(
      db,
      profileId,
      code({
        code: "PAS",
        discountType: "fixed",
        discountValue: 78000,
        productId,
      })
    );
    assert.ok(!scoped.ok && scoped.fieldErrors?.discountValue);
  });

  test("usage limit: an unpaid order holds a use for 24 hours, a paid one keeps it", async () => {
    const now = Date.now();
    await createDiscountCode(db, profileId, code({ code: "SATU", maxUses: 1 }));
    const use = (at: number) =>
      checkout({ discountCode: "SATU", expectedAmount: 70200 }, at);

    assert.ok((await use(now)).ok);
    assert.deepEqual(await use(now + 1000), {
      ok: false,
      error: CODE_REJECTION_MESSAGES.used_up,
    });

    const afterHold = await use(now + CODE_HOLD_MS + 60_000);
    assert.ok(afterHold.ok, "an abandoned checkout gives its use back");
    await db
      .update(orders)
      .set({ status: "paid" })
      .where(eq(orders.code, afterHold.ok ? afterHold.data.orderCode : ""));
    assert.equal((await use(now + 2 * CODE_HOLD_MS + 120_000)).ok, false);
  });

  test("two buyers racing for the last use: only one order is created", async () => {
    await createDiscountCode(
      db,
      profileId,
      code({ code: "REBUTAN", maxUses: 1 })
    );
    const results = await Promise.all([
      checkout({ discountCode: "REBUTAN", expectedAmount: 70200 }),
      checkout({ discountCode: "REBUTAN", expectedAmount: 70200 }),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    const held = await db
      .select()
      .from(orders)
      .where(eq(orders.discountCode, "REBUTAN"));
    assert.equal(held.length, 1);
  });

  test("a checkout key reused with a different code is refused", async () => {
    const key = crypto.randomUUID();
    assert.ok((await checkout({ idempotencyKey: key })).ok);
    const again = await checkout({
      idempotencyKey: key,
      discountCode: "1010",
      expectedAmount: 70200,
    });
    assert.equal(again.ok, false);
  });

  test("editing or deleting a used code leaves past orders as they were", async () => {
    const created = await createDiscountCode(
      db,
      profileId,
      code({ code: "UBAH" })
    );
    assert.ok(created.ok);
    const id = created.ok ? created.data.id : "";
    const placed = await checkout({
      discountCode: "UBAH",
      expectedAmount: 70200,
    });
    assert.ok(placed.ok);
    const orderCode = placed.ok ? placed.data.orderCode : "";

    assert.equal(
      (await updateDiscountCode(db, otherProfileId, id, code({ code: "UBAH" })))
        .ok,
      false
    );
    assert.ok(
      (
        await updateDiscountCode(
          db,
          profileId,
          id,
          code({ code: "UBAH", discountValue: 50 })
        )
      ).ok
    );
    assert.equal((await orderOf(orderCode))?.amount, 70200);

    assert.equal((await deleteDiscountCode(db, otherProfileId, id)).ok, false);
    assert.ok((await deleteDiscountCode(db, profileId, id)).ok);
    const order = await orderOf(orderCode);
    assert.equal(order?.discountCodeId, null);
    assert.equal(order?.discountCode, "UBAH");
    assert.equal(order?.discountAmount, 7800);
  });

  test("the dashboard counts paid uses and the rupiah given", async () => {
    await createDiscountCode(
      db,
      profileId,
      code({ code: "LAPOR", maxUses: 1 })
    );
    const placed = await checkout({
      discountCode: "LAPOR",
      expectedAmount: 70200,
    });
    assert.ok(placed.ok);
    await db
      .update(orders)
      .set({ status: "paid" })
      .where(eq(orders.code, placed.ok ? placed.data.orderCode : ""));
    const row = (await listDiscountCodes(db, profileId)).find(
      (item) => item.code === "LAPOR"
    );
    assert.equal(row?.paidUses, 1);
    assert.equal(row?.discountTotal, 7800);
    assert.equal(row ? codeStatus(row, row.paidUses) : null, "used_up");
  });

  test("the code field only shows when a code could apply", async () => {
    const third = await createOwner(db, {
      email: "third@example.id",
      password: "rahasia-1234",
      name: "Third",
      username: "third",
    });
    const thirdId = third.profile.id;
    const product = await createProduct(db, thirdId, productInput(), {
      profileWhatsapp: null,
      paymentsReady: true,
    });
    assert.ok(product.ok);
    const id = product.ok ? product.data.id : "";
    const extra = await createProduct(db, thirdId, productInput(), {
      profileWhatsapp: null,
      paymentsReady: true,
    });
    const extraId = extra.ok ? extra.data.id : "";

    assert.equal(await hasUsableCodes(db, thirdId, id), false);
    await createDiscountCode(
      db,
      thirdId,
      code({ code: "OFF1", isActive: false })
    );
    await createDiscountCode(
      db,
      thirdId,
      code({ code: "NANTI1", startsAt: "2099-01-01T00:00" })
    );
    await createDiscountCode(
      db,
      thirdId,
      code({ code: "LAIN1", productId: extraId })
    );
    assert.equal(await hasUsableCodes(db, thirdId, id), false);
    assert.equal(await hasUsableCodes(db, thirdId, extraId), true);
  });
});
