import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { orders } from "@/db/schema";
import { emailConfig } from "@/lib/env";
import { productInputSchema } from "@/lib/validation";
import {
  applyGatewayStatus,
  findOrderForBuyer,
  rotateOrderAccess,
  startCheckout,
} from "@/server/checkout";
import {
  deliverOrderEmails,
  type EmailDeps,
  sendPaymentLinkEmail,
} from "@/server/email/order-emails";
import {
  createResendSender,
  EmailError,
  type EmailMessage,
} from "@/server/email/resend";
import {
  escapeHtml,
  fromHeader,
  paymentLinkEmail,
  receiptEmail,
  sellerOrderEmail,
} from "@/server/email/templates";
import { orderEmailKey } from "@/server/order-access";
import type { PaymentGateway } from "@/server/payments/gateway";
import { createProduct } from "@/server/products";
import { createOwner } from "@/server/setup";

import { createTestDb } from "./helpers/db";

const SECRET = "test-secret-for-order-email-links-0123456789";
const SITE = "https://toko.example.id";

let db: Database;
let cleanup: () => void;
let productId: string;

const gateway: PaymentGateway = {
  provider: "midtrans",
  async createTransaction(input) {
    return {
      token: `tok-${input.orderCode}`,
      redirectUrl: `https://pay.example/${input.orderCode}`,
    };
  },
  async getStatus() {
    return null;
  },
  verifyNotification() {
    return true;
  },
};

/** Collects messages; fails while `failing` is set. */
function recorder() {
  const sent: EmailMessage[] = [];
  const state = { failing: false };
  const deps: EmailDeps = {
    async send(message) {
      if (state.failing) throw new EmailError("down");
      sent.push(message);
    },
    fromAddress: "pesanan@toko.example.id",
    siteUrl: SITE,
    secret: SECRET,
  };
  return { sent, state, deps };
}

async function newOrder(buyerName = "Budi <b>") {
  const result = await startCheckout(
    db,
    gateway,
    {
      productId,
      idempotencyKey: crypto.randomUUID(),
      expectedAmount: 50000,
      discountCode: null,
      buyerName,
      buyerEmail: "budi@example.id",
      buyerPhone: null,
    },
    {
      siteUrl: SITE,
      visitor: {
        visitorId: null,
        sessionId: null,
        sessionSource: null,
        userAgent: null,
        siteHost: null,
      },
    }
  );
  assert.ok(result.ok && result.data.accessToken);
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, result.data.orderId),
  });
  assert.ok(order);
  return { order, token: result.data.accessToken };
}

async function markPaid(code: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.code, code),
  });
  assert.ok(order);
  await applyGatewayStatus(db, order, {
    orderId: order.code,
    transactionStatus: "settlement",
    fraudStatus: null,
    statusCode: "200",
    grossAmount: order.amount,
    transactionId: "t-1",
    paymentType: "qris",
  });
}

before(async () => {
  ({ db, cleanup } = await createTestDb());
  const owner = await createOwner(db, {
    email: "penjual@example.id",
    password: "rahasia-1234",
    name: "Penjual",
    username: "penjual",
  });
  const product = await createProduct(
    db,
    owner.profile.id,
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
  productId = product.ok ? product.data.id : "";
});

after(() => cleanup());

describe("templates", () => {
  const base = {
    sellerName: "Toko <Ana>",
    brandName: "Platform",
    accent: "#1d4fd8",
    buyerName: '<img src=x onerror="alert(1)">',
    orderCode: "LB-2345ABCD",
    productName: "Template & Kit",
    total: 45000,
  };
  const all = [
    receiptEmail({
      ...base,
      listAmount: 50000,
      discountCode: "HEMAT",
      discountAmount: 5000,
      paidAt: new Date(Date.UTC(2026, 9, 13, 9)),
      paymentMethod: "QRIS",
      orderUrl: `${SITE}/pesanan/LB-2345ABCD?k=abc`,
      invoiceUrl: `${SITE}/pesanan/LB-2345ABCD/invoice?k=abc`,
      hasDelivery: true,
    }),
    paymentLinkEmail({
      ...base,
      orderUrl: `${SITE}/pesanan/LB-2345ABCD?k=abc`,
    }),
    sellerOrderEmail({
      ...base,
      buyerEmail: "a@b.id",
      buyerPhone: null,
      paidAt: new Date(),
      paymentMethod: null,
      dashboardUrl: `${SITE}/admin/orders?q=LB-2345ABCD`,
      hasDelivery: true,
    }),
  ];

  test("what buyers and sellers type is escaped in the HTML", () => {
    for (const email of all) {
      assert.ok(!email.html.includes("<img src=x"), email.subject);
      assert.ok(!email.html.includes("Template & Kit"));
      assert.ok(email.html.includes("Template &amp; Kit"));
    }
    assert.equal(escapeHtml(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");
  });

  test("no email names the payment gateway, and none uses an em dash", () => {
    for (const email of all) {
      const everything = `${email.subject}\n${email.html}\n${email.text}`;
      assert.ok(!/midtrans/i.test(everything), email.subject);
      assert.ok(!everything.includes("—"), email.subject);
    }
  });

  test("the receipt carries the invoice lines and the order link", () => {
    const [receipt] = all;
    assert.equal(receipt?.subject, "Pembayaran berhasil: Template & Kit");
    for (const part of [
      "LB-2345ABCD",
      "Rp50.000",
      "HEMAT",
      "Rp45.000",
      "QRIS",
      "Buka produk",
    ])
      assert.ok(receipt?.text.includes(part), part);
    assert.ok(receipt?.html.includes(`${SITE}/pesanan/LB-2345ABCD?k=abc`));
  });

  test("sender names cannot break the From header", () => {
    assert.equal(
      fromHeader(
        'Toko "Ana" <x@evil.id>\r\nBcc: y@evil.id',
        "pesanan@toko.example.id"
      ),
      '"Toko Ana x@evil.id Bcc: y@evil.id" <pesanan@toko.example.id>'
    );
    assert.equal(
      fromHeader("  ", "pesanan@toko.example.id"),
      "pesanan@toko.example.id"
    );
  });
});

describe("order links in emails", () => {
  test("the email key opens the order until a new order link is issued", async () => {
    const { order } = await newOrder();
    const key = orderEmailKey(order.code, order.accessTokenHash, SECRET);
    assert.ok(
      await findOrderForBuyer(db, order.code, null, { key, secret: SECRET })
    );
    assert.equal(
      await findOrderForBuyer(db, order.code, null, {
        key: `${key}x`,
        secret: SECRET,
      }),
      null
    );
    assert.equal(
      await findOrderForBuyer(db, order.code, null, {
        key,
        secret: "another-secret",
      }),
      null
    );
    await rotateOrderAccess(db, order.profileId, order.id, SITE);
    assert.equal(
      await findOrderForBuyer(db, order.code, null, { key, secret: SECRET }),
      null,
      "a new link retires the emailed one"
    );
  });
});

describe("sending", () => {
  test("the payment link goes out once, while the order waits", async () => {
    const { sent, deps } = recorder();
    const { order } = await newOrder();
    assert.equal(await sendPaymentLinkEmail(db, order.id, deps), "sent");
    assert.equal(await sendPaymentLinkEmail(db, order.id, deps), "skipped");
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.to, "budi@example.id");
    assert.equal(sent[0]?.idempotencyKey, `payment-link/${order.id}`);
    assert.match(sent[0]?.text ?? "", /\/pesanan\/LB-[A-Z0-9]{8}\?k=/);
  });

  test("a paid order sends the receipt to the buyer and the notice to the seller, once", async () => {
    const { sent, deps } = recorder();
    const { order } = await newOrder("Budi");
    assert.deepEqual(await deliverOrderEmails(db, order.id, deps), {
      receipt: "skipped",
      seller: "skipped",
    });
    await markPaid(order.code);
    assert.deepEqual(await deliverOrderEmails(db, order.id, deps), {
      receipt: "sent",
      seller: "sent",
    });
    assert.deepEqual(await deliverOrderEmails(db, order.id, deps), {
      receipt: "skipped",
      seller: "skipped",
    });
    const [receipt, seller] = sent;
    assert.equal(receipt?.to, "budi@example.id");
    assert.equal(receipt?.from, '"Penjual" <pesanan@toko.example.id>');
    assert.match(receipt?.text ?? "", /\/invoice\?k=/);
    assert.ok(receipt?.text.includes("QRIS"));
    assert.equal(seller?.to, "penjual@example.id");
    assert.match(seller?.subject ?? "", /^Pesanan baru: Template Toko/);
  });

  test("a failed send is retried on the next trigger", async () => {
    const { sent, state, deps } = recorder();
    const { order } = await newOrder("Budi");
    await markPaid(order.code);
    state.failing = true;
    assert.deepEqual(await deliverOrderEmails(db, order.id, deps), {
      receipt: "failed",
      seller: "failed",
    });
    state.failing = false;
    assert.deepEqual(await deliverOrderEmails(db, order.id, deps), {
      receipt: "sent",
      seller: "sent",
    });
    assert.equal(sent.length, 2);
  });
});

describe("Resend", () => {
  test("posts the message with the idempotency key", async () => {
    let request: { url: string; init: RequestInit } | null = null;
    const send = createResendSender(
      { apiKey: "re_test", fromAddress: "pesanan@toko.example.id" },
      async (url, init) => {
        request = { url: String(url), init: init ?? {} };
        return Response.json({ id: "email-1" });
      }
    );
    await send({
      from: "Toko <pesanan@toko.example.id>",
      to: "budi@example.id",
      subject: "Halo",
      html: "<p>Halo</p>",
      text: "Halo",
      idempotencyKey: "receipt/1",
    });
    assert.equal(request!.url, "https://api.resend.com/emails");
    const headers = request!.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer re_test");
    assert.equal(headers["Idempotency-Key"], "receipt/1");
    assert.deepEqual(JSON.parse(String(request!.init.body)).to, [
      "budi@example.id",
    ]);
  });

  test("a refused email throws, so the claim is given back", async () => {
    const send = createResendSender(
      { apiKey: "re_test", fromAddress: "pesanan@toko.example.id" },
      async () =>
        Response.json({ message: "domain not verified" }, { status: 403 })
    );
    await assert.rejects(
      send({
        from: "a@b.id",
        to: "c@d.id",
        subject: "x",
        html: "x",
        text: "x",
        idempotencyKey: "k",
      }),
      /domain not verified/
    );
  });

  test("a reused idempotency key counts as already sent", async () => {
    const send = createResendSender(
      { apiKey: "re_test", fromAddress: "pesanan@toko.example.id" },
      async () => Response.json({ message: "conflict" }, { status: 409 })
    );
    await send({
      from: "a@b.id",
      to: "c@d.id",
      subject: "x",
      html: "x",
      text: "x",
      idempotencyKey: "receipt/1",
    });
  });

  test("email stays off until both the key and the sender address are set", () => {
    const saved = {
      key: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    };
    try {
      process.env.RESEND_API_KEY = "re_test";
      delete process.env.EMAIL_FROM;
      assert.equal(emailConfig(), null);
      process.env.EMAIL_FROM = "not an address";
      assert.equal(emailConfig(), null);
      process.env.EMAIL_FROM = "pesanan@toko.example.id";
      assert.deepEqual(emailConfig(), {
        apiKey: "re_test",
        fromAddress: "pesanan@toko.example.id",
      });
    } finally {
      for (const [name, value] of [
        ["RESEND_API_KEY", saved.key],
        ["EMAIL_FROM", saved.from],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
