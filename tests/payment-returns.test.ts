import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { profiles, webhookEvents } from "@/db/schema";
import { midtransUrls } from "@/lib/midtrans-urls";
import { productInputSchema } from "@/lib/validation";
import type { VisitorContext } from "@/server/analytics/ingest";
import {
  handleMidtransNotification,
  handleMidtransRecurringNotification,
  startCheckout,
} from "@/server/checkout";
import {
  addRecentOrder,
  midtransRedirect,
  orderSeller,
  readCookie,
  RECENT_ORDERS_COOKIE,
  recentOrderToken,
  redirectOrderId,
} from "@/server/order-access";
import type {
  CreateTransactionInput,
  PaymentGateway,
} from "@/server/payments/gateway";
import {
  createMidtransGateway,
  midtransSignature,
} from "@/server/payments/midtrans";
import { createProduct } from "@/server/products";
import { createOwner } from "@/server/setup";

import { createTestDb } from "./helpers/db";

const SERVER_KEY = "SB-Mid-server-test-returns";
const SITE = "https://toko.example.id";
const CODE_A = "LB-2345ABCD";
const CODE_B = "LB-EFGH6789";
const TOKEN_A = "a".repeat(43);
const TOKEN_B = "b".repeat(43);

let db: Database;
let cleanup: () => void;
let profileId: string;
let order: { code: string; token: string };
const requests: CreateTransactionInput[] = [];

const gateway: PaymentGateway = {
  provider: "midtrans",
  async createTransaction(input) {
    requests.push(input);
    return {
      token: `tok-${input.orderCode}`,
      redirectUrl: `https://app.sandbox.midtrans.com/snap/v4/redirection/tok-${input.orderCode}`,
    };
  },
  async getStatus() {
    return null;
  },
  verifyNotification(payload) {
    return midtransSignature(payload, SERVER_KEY) === payload.signature_key;
  },
};

const visitor: VisitorContext = {
  visitorId: "buyer",
  sessionId: "s-buyer",
  sessionSource: null,
  userAgent: null,
  siteHost: "toko.example.id",
};

before(async () => {
  ({ db, cleanup } = await createTestDb());
  const owner = await createOwner(db, {
    email: "penjual@example.id",
    password: "rahasia-1234",
    name: "Penjual",
    username: "penjual",
  });
  profileId = owner.profile.id;
  const product = await createProduct(
    db,
    profileId,
    productInputSchema.parse({
      name: "Template Toko",
      slug: "template-toko",
      priceAmount: 50000,
      productType: "template",
      status: "published",
      checkoutMethod: "direct",
      deliveryType: "link",
      deliveryUrl: "https://drive.example/template",
    }),
    { profileWhatsapp: null, paymentsReady: true }
  );
  assert.ok(product.ok);
  const checkout = await startCheckout(
    db,
    gateway,
    {
      items: [{ productId: product.ok ? product.data.id : "", quantity: 1 }],
      idempotencyKey: crypto.randomUUID(),
      expectedAmount: 50000,
      discountCode: null,
      buyerName: "Budi",
      buyerEmail: "budi@example.id",
      buyerPhone: null,
    },
    { siteUrl: SITE, visitor }
  );
  assert.ok(checkout.ok && checkout.data.accessToken);
  order = { code: checkout.data.orderCode, token: checkout.data.accessToken };
});

after(() => cleanup());

describe("recent orders cookie", () => {
  test("keeps the newest five orders, once each, and finds their tokens", () => {
    let cookie = addRecentOrder(null, CODE_A, TOKEN_A);
    cookie = addRecentOrder(cookie, CODE_B, TOKEN_B);
    assert.equal(cookie, `${CODE_B}:${TOKEN_B}|${CODE_A}:${TOKEN_A}`);
    assert.equal(recentOrderToken(cookie, CODE_A), TOKEN_A);

    cookie = addRecentOrder(cookie, CODE_A, TOKEN_B);
    assert.equal(cookie, `${CODE_A}:${TOKEN_B}|${CODE_B}:${TOKEN_B}`);

    for (const suffix of ["2222AAAA", "3333BBBB", "4444CCCC", "5555DDDD"])
      cookie = addRecentOrder(cookie, `LB-${suffix}`, TOKEN_A);
    assert.equal(cookie.split("|").length, 5);
    assert.equal(
      recentOrderToken(cookie, CODE_B),
      null,
      "the oldest is dropped"
    );
  });

  test("ignores anything that is not an order and a token", () => {
    const cookie = `junk|${CODE_A}:short|ORDER-1:${TOKEN_A}|${CODE_B}:${TOKEN_B}:x`;
    assert.equal(recentOrderToken(cookie, CODE_A), null);
    assert.equal(recentOrderToken(cookie, CODE_B), null);
    assert.equal(
      addRecentOrder(cookie, CODE_A, TOKEN_A),
      `${CODE_A}:${TOKEN_A}`
    );
  });

  test("is read from the Cookie header by name", () => {
    const header = `theme=dark; ${RECENT_ORDERS_COOKIE}=${encodeURIComponent(`${CODE_A}:${TOKEN_A}`)}; other=1`;
    assert.equal(
      readCookie(header, RECENT_ORDERS_COOKIE),
      `${CODE_A}:${TOKEN_A}`
    );
    assert.equal(readCookie(header, "missing"), null);
    assert.equal(readCookie(null, RECENT_ORDERS_COOKIE), null);
  });
});

describe("Midtrans redirects", () => {
  const url = (path: string) => `${SITE}/api/payments/midtrans/${path}`;
  const withCookie = (value: string) => ({
    cookie: `${RECENT_ORDERS_COOKIE}=${encodeURIComponent(value)}`,
  });

  test("the order number is read from the query, a form or a JSON body", async () => {
    assert.equal(
      await redirectOrderId(
        new Request(url(`finish?order_id=${CODE_A}&status_code=200`))
      ),
      CODE_A
    );
    const posted = (body: string, type: string) =>
      redirectOrderId(
        new Request(url("finish"), {
          method: "POST",
          headers: { "content-type": type },
          body,
        })
      );
    const form = "application/x-www-form-urlencoded";
    assert.equal(await posted(`order_id=${CODE_A}`, form), CODE_A);
    assert.equal(
      await posted(
        `response=${encodeURIComponent(JSON.stringify({ order_id: CODE_B, transaction_status: "settlement" }))}`,
        form
      ),
      CODE_B
    );
    assert.equal(
      await posted(JSON.stringify({ order_id: CODE_A }), "application/json"),
      CODE_A
    );
    assert.equal(await posted("response=%7Bnot-json", form), null);
    assert.equal(await redirectOrderId(new Request(url("finish"))), null);
  });

  test("a browser holding the order's link goes back to its order page", async () => {
    const cookie = addRecentOrder(null, order.code, order.token);
    const unfinished = await midtransRedirect(
      db,
      new Request(url(`unfinish?order_id=${order.code}`), {
        headers: withCookie(cookie),
      }),
      "belum-selesai"
    );
    assert.equal(unfinished.status, 303);
    assert.equal(
      unfinished.headers.get("location"),
      `${SITE}/pesanan/${order.code}?t=${order.token}&hasil=belum-selesai`
    );

    // A POST (some payment methods) becomes a GET of the order page.
    const finished = await midtransRedirect(
      db,
      new Request(url("finish"), {
        method: "POST",
        headers: {
          ...withCookie(cookie),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: `response=${encodeURIComponent(JSON.stringify({ order_id: order.code }))}`,
      }),
      "selesai"
    );
    assert.equal(finished.status, 303);
    assert.equal(
      finished.headers.get("location"),
      `${SITE}/pesanan/${order.code}?t=${order.token}`
    );
  });

  test("without the right link the buyer gets the general page, never the order", async () => {
    const wrongToken = await midtransRedirect(
      db,
      new Request(url(`error?order_id=${order.code}`), {
        headers: withCookie(addRecentOrder(null, order.code, TOKEN_B)),
      }),
      "gagal"
    );
    assert.equal(
      wrongToken.headers.get("location"),
      `${SITE}/pembayaran/gagal?pesanan=${order.code}`
    );

    const noCookie = await midtransRedirect(
      db,
      new Request(url(`unfinish?order_id=${order.code}`)),
      "belum-selesai"
    );
    assert.equal(
      noCookie.headers.get("location"),
      `${SITE}/pembayaran/belum-selesai?pesanan=${order.code}`
    );

    // Another shop's order on the same Midtrans account.
    const foreign = await midtransRedirect(
      db,
      new Request(url("finish?order_id=ORDER-STORE-1001")),
      "selesai"
    );
    assert.equal(foreign.headers.get("location"), `${SITE}/pembayaran/selesai`);
  });

  test("the general page learns only who the seller is, and only while the profile is public", async () => {
    assert.deepEqual(await orderSeller(db, order.code), {
      profileId,
      username: "penjual",
      displayName: "Penjual",
    });
    assert.equal(await orderSeller(db, CODE_A), null);
    assert.equal(await orderSeller(db, "not-an-order"), null);
    await db
      .update(profiles)
      .set({ isPublished: false })
      .where(eq(profiles.id, profileId));
    assert.equal(await orderSeller(db, order.code), null);
    await db
      .update(profiles)
      .set({ isPublished: true })
      .where(eq(profiles.id, profileId));
  });
});

describe("what each order sends to Midtrans", () => {
  test("finish and error redirects carry the order's link; notifications come back here", async () => {
    const sent = requests.at(-1);
    assert.equal(
      sent?.finishUrl,
      `${SITE}/pesanan/${order.code}?t=${order.token}`
    );
    assert.equal(
      sent?.errorUrl,
      `${SITE}/pesanan/${order.code}?t=${order.token}&hasil=gagal`
    );

    let body: Record<string, unknown> = {};
    let headers: Record<string, string> = {};
    const midtrans = createMidtransGateway(
      { serverKey: SERVER_KEY, isProduction: false },
      async (_url, init) => {
        body = JSON.parse(String(init?.body));
        headers = init?.headers as Record<string, string>;
        return Response.json({
          token: "t",
          redirect_url: "https://snap.example",
        });
      }
    );
    await midtrans.createTransaction({
      ...sent!,
      notificationUrl: midtransUrls(SITE).notification,
    });
    assert.deepEqual(body.callbacks, {
      finish: sent?.finishUrl,
      error: sent?.errorUrl,
    });
    assert.equal(
      headers["X-Override-Notification"],
      `${SITE}/api/payments/midtrans`
    );
  });

  test("the dashboard URLs all live under /api/payments/midtrans", () => {
    assert.deepEqual(midtransUrls(SITE), {
      finish: `${SITE}/api/payments/midtrans/finish`,
      unfinish: `${SITE}/api/payments/midtrans/unfinish`,
      error: `${SITE}/api/payments/midtrans/error`,
      notification: `${SITE}/api/payments/midtrans`,
      recurring: `${SITE}/api/payments/midtrans/recurring`,
      accountLinking: `${SITE}/api/payments/midtrans/account-linking`,
    });
  });
});

describe("recurring notifications", () => {
  test("anything but a payment is acknowledged so Midtrans stops retrying", async () => {
    const result = await handleMidtransRecurringNotification(
      db,
      () => gateway,
      JSON.stringify({ id: "sub-1", status: "active", schedule: {} })
    );
    assert.deepEqual(result, {
      httpStatus: 200,
      result: "ignored:not_a_payment",
    });
    assert.equal(
      (await handleMidtransRecurringNotification(db, () => gateway, "{oops"))
        .httpStatus,
      400
    );
  });

  test("a payment notification is verified like any other", async () => {
    const payload = {
      order_id: order.code,
      status_code: "200",
      gross_amount: "50000.00",
      transaction_status: "settlement",
    };
    const forged = await handleMidtransRecurringNotification(
      db,
      () => gateway,
      JSON.stringify({ ...payload, signature_key: "0".repeat(128) })
    );
    assert.equal(forged.httpStatus, 403);
    const signed = await handleMidtransRecurringNotification(
      db,
      () => gateway,
      JSON.stringify({
        ...payload,
        signature_key: midtransSignature(payload, SERVER_KEY),
      })
    );
    // The fake gateway's Status API does not know the order: nothing changes.
    assert.deepEqual(signed, {
      httpStatus: 200,
      result: "ignored:not_found_at_provider",
    });
  });
});

describe("notification payloads as Midtrans sends them", () => {
  /** Shaped like the dashboard's "Test notification URL" request. */
  function dashboardTest(signedWith: string) {
    const payload = {
      transaction_type: "on-us",
      transaction_time: "2026-10-13 15:20:01",
      transaction_status: "capture",
      transaction_id: "513f1f01-c9da-474c-9fc9-d5c64364b709",
      status_message: "midtrans payment notification",
      status_code: "200",
      payment_type: "credit_card",
      order_id:
        "payment_notif_test_G621680278_c4b6a1c6-2b4f-4b7e-9d1e-6a1f8b0e2c3d",
      merchant_id: "G621680278",
      masked_card: "48111111-1114",
      gross_amount: "105000.00",
      fraud_status: "accept",
      currency: "IDR",
      channel_response_message: "Approved",
      bank: "bni",
    };
    return JSON.stringify({
      ...payload,
      signature_key: midtransSignature(payload, signedWith),
    });
  }

  test("the dashboard test gets 200 and nothing is stored", async () => {
    const before = (await db.select().from(webhookEvents)).length;
    assert.deepEqual(
      await handleMidtransNotification(
        db,
        () => gateway,
        dashboardTest(SERVER_KEY)
      ),
      { httpStatus: 200, result: "test:signature_ok" }
    );
    // Signed with another account's key: still 200, but the log says so.
    assert.deepEqual(
      await handleMidtransNotification(
        db,
        () => gateway,
        dashboardTest("SB-Mid-server-another-account")
      ),
      { httpStatus: 200, result: "test:signature_mismatch" }
    );
    assert.deepEqual(
      await handleMidtransNotification(
        db,
        () => null,
        dashboardTest(SERVER_KEY)
      ),
      { httpStatus: 200, result: "test:no_server_key" }
    );
    assert.equal((await db.select().from(webhookEvents)).length, before);
  });

  test("optional fields sent as null are accepted", async () => {
    const payload = {
      order_id: order.code,
      status_code: "201",
      gross_amount: "50000.00",
      transaction_status: "pending",
      fraud_status: null,
      transaction_id: null,
      payment_type: null,
    };
    const result = await handleMidtransNotification(
      db,
      () => gateway,
      JSON.stringify({
        ...payload,
        signature_key: midtransSignature(payload, SERVER_KEY),
      })
    );
    assert.equal(result.httpStatus, 200);
  });

  test("a payload Midtrans would never send is refused, naming the fields", async () => {
    const result = await handleMidtransNotification(
      db,
      () => gateway,
      JSON.stringify({ order_id: order.code, status_code: 200 })
    );
    assert.equal(result.httpStatus, 400);
    assert.equal(
      result.result,
      "invalid_payload:status_code,gross_amount,signature_key,transaction_status"
    );
  });
});
