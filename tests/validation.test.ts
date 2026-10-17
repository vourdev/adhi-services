import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  mapProviderStatus,
  nextOrderStatus,
  parseGrossAmount,
} from "@/server/payments/gateway";
import { midtransSignature } from "@/server/payments/midtrans";
import {
  generateOrderCode,
  hashPassword,
  signExpiring,
  verifyExpiring,
  verifyPassword,
} from "@/lib/security";
import {
  checkoutInputSchema,
  discountCodeInputSchema,
  isSafeImageUrl,
  isSafeLinkUrl,
  linkInputSchema,
  normalizeSocialUrl,
  parseRupiah,
  productInputSchema,
  slugify,
  usernameSchema,
} from "@/lib/validation";
import { renderWhatsAppTemplate } from "@/lib/whatsapp";

describe("link URL safety", () => {
  test("accepts http(s), mailto, tel and internal paths", () => {
    for (const url of [
      "https://example.com/a?b=1",
      "http://example.com",
      "mailto:a@b.co",
      "tel:+62812",
      "/privasi",
    ]) {
      assert.equal(isSafeLinkUrl(url), true, url);
    }
  });

  test("rejects dangerous or malformed URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      " javascript:alert(1)",
      "data:text/html,<script>",
      "vbscript:x",
      "//evil.com",
      "/\\evil.com",
      "https://user:pass@example.com",
      "file:///etc/passwd",
      "",
      "example.com",
    ]) {
      assert.equal(isSafeLinkUrl(url), false, url);
    }
  });

  test("images must be https or local", () => {
    assert.equal(isSafeImageUrl("/media/2026/x.webp"), true);
    assert.equal(isSafeImageUrl("https://cdn.example.com/a.png"), true);
    assert.equal(isSafeImageUrl("http://cdn.example.com/a.png"), false);
    assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  });

  test("link schema requires a title and a safe URL, headings need no URL", () => {
    assert.equal(
      linkInputSchema.safeParse({
        kind: "link",
        title: "",
        url: "https://a.co",
      }).success,
      false
    );
    assert.equal(
      linkInputSchema.safeParse({
        kind: "link",
        title: "A",
        url: "javascript:alert(1)",
      }).success,
      false
    );
    const heading = linkInputSchema.parse({
      kind: "heading",
      title: "Produk",
      url: "javascript:alert(1)",
    });
    assert.equal(heading.url, null);
  });

  test("WhatsApp links need an opening message and never keep a URL", () => {
    assert.equal(
      linkInputSchema.safeParse({ kind: "whatsapp", title: "Jasa Website" })
        .success,
      false,
      "a message is required"
    );
    const whatsapp = linkInputSchema.parse({
      kind: "whatsapp",
      title: "Jasa Website",
      url: "https://evil.example",
      message: "  Halo, saya mau konsultasi.  ",
    });
    assert.equal(whatsapp.url, null);
    assert.equal(whatsapp.message, "Halo, saya mau konsultasi.");
    const link = linkInputSchema.parse({
      kind: "link",
      title: "Web",
      url: "https://example.id",
      message: "ignored",
    });
    assert.equal(link.message, null);
  });
});

describe("usernames, slugs, money", () => {
  test("usernames are normalised and reserved names are refused", () => {
    assert.equal(usernameSchema.parse("@AdhiNugroho"), "adhinugroho");
    assert.equal(usernameSchema.safeParse("admin").success, false);
    assert.equal(usernameSchema.safeParse("ab").success, false);
    assert.equal(usernameSchema.safeParse("robots.txt").success, false);
    assert.equal(usernameSchema.safeParse("-adhi").success, false);
  });

  test("slugify", () => {
    assert.equal(
      slugify("Template Portofolio Developer + CMS!"),
      "template-portofolio-developer-cms"
    );
    assert.equal(slugify("Café Déjà"), "cafe-deja");
  });

  test("parseRupiah", () => {
    assert.equal(parseRupiah("Rp 25.000"), 25000);
    assert.equal(parseRupiah("25000"), 25000);
    assert.equal(parseRupiah("25,5"), null);
    assert.equal(parseRupiah(-1), null);
  });

  test("social URLs are normalised per platform", () => {
    assert.equal(
      normalizeSocialUrl("email", "hi@example.com"),
      "mailto:hi@example.com"
    );
    assert.equal(
      normalizeSocialUrl("whatsapp", "0812-3456-7890"),
      "https://wa.me/6281234567890"
    );
    assert.equal(normalizeSocialUrl("instagram", "javascript:alert(1)"), null);
    assert.equal(
      normalizeSocialUrl("portfolio", "https://muhammadadhi.vour.dev"),
      "https://muhammadadhi.vour.dev/"
    );
    assert.equal(
      normalizeSocialUrl("instagram", "https://instagram.com/x"),
      "https://instagram.com/x"
    );
  });
});

describe("product rules", () => {
  const base = {
    name: "Template",
    slug: "template",
    priceAmount: 25000,
    productType: "template",
    status: "draft",
    checkoutMethod: "whatsapp",
  } as const;

  test("WhatsApp templates must include product, price and link", () => {
    const result = productInputSchema.safeParse({
      ...base,
      whatsappTemplate: "Halo, mau beli {produk}",
    });
    assert.equal(result.success, false);
    assert.equal(
      productInputSchema.safeParse({
        ...base,
        whatsappTemplate: "{produk} {harga} {link}",
      }).success,
      true
    );
  });

  test("link delivery requires an https link", () => {
    assert.equal(
      productInputSchema.safeParse({ ...base, deliveryType: "link" }).success,
      false
    );
    assert.equal(
      productInputSchema.safeParse({
        ...base,
        deliveryType: "link",
        deliveryUrl: "http://x.co",
      }).success,
      false
    );
    assert.equal(
      productInputSchema.safeParse({
        ...base,
        deliveryType: "link",
        deliveryUrl: "https://x.co/f",
      }).success,
      true
    );
  });

  test("template rendering fills every placeholder", () => {
    assert.equal(
      renderWhatsAppTemplate("Beli {produk} ({harga}) {link}", {
        produk: "A",
        harga: "Rp1",
        link: "https://x",
      }),
      "Beli A (Rp1) https://x"
    );
  });
});

describe("security helpers", () => {
  test("password hashing verifies the right password only", async () => {
    const hash = await hashPassword("rahasia-123");
    assert.match(hash, /^scrypt\$/);
    assert.equal(await verifyPassword("rahasia-123", hash), true);
    assert.equal(await verifyPassword("rahasia-124", hash), false);
    assert.equal(await verifyPassword("x", "garbage"), false);
  });

  test("signed links expire and reject tampering", () => {
    const now = Date.now();
    const { exp, sig } = signExpiring(
      "secret-secret-secret-secret-1234",
      "download:abc",
      now + 60_000
    );
    assert.equal(
      verifyExpiring(
        "secret-secret-secret-secret-1234",
        "download:abc",
        exp,
        sig,
        now
      ),
      true
    );
    assert.equal(
      verifyExpiring(
        "secret-secret-secret-secret-1234",
        "download:abd",
        exp,
        sig,
        now
      ),
      false
    );
    assert.equal(
      verifyExpiring(
        "secret-secret-secret-secret-1234",
        "download:abc",
        exp,
        sig,
        now + 120_000
      ),
      false
    );
    assert.equal(
      verifyExpiring(
        "secret-secret-secret-secret-1234",
        "download:abc",
        null,
        sig,
        now
      ),
      false
    );
  });

  test("order codes use an unambiguous alphabet", () => {
    for (let index = 0; index < 50; index++)
      assert.match(generateOrderCode(), /^LB-[2-9A-HJ-NP-Z]{8}$/);
  });
});

describe("payment status rules", () => {
  test("Midtrans signature matches the documented formula", () => {
    // SHA512(order_id + status_code + gross_amount + ServerKey)
    const signature = midtransSignature(
      { order_id: "LB-1", status_code: "200", gross_amount: "25000.00" },
      "SB-key"
    );
    assert.match(signature, /^[0-9a-f]{128}$/);
    assert.notEqual(
      signature,
      midtransSignature(
        { order_id: "LB-1", status_code: "200", gross_amount: "25001.00" },
        "SB-key"
      )
    );
  });

  test("status mapping follows Midtrans guidance", () => {
    assert.equal(mapProviderStatus("settlement", null), "paid");
    assert.equal(mapProviderStatus("capture", "accept"), "paid");
    assert.equal(mapProviderStatus("capture", "challenge"), "pending");
    assert.equal(mapProviderStatus("expire", null), "expired");
    assert.equal(mapProviderStatus("deny", null), "failed");
    assert.equal(mapProviderStatus("partial_refund", null), null);
  });

  test("a paid order is never downgraded", () => {
    assert.equal(nextOrderStatus("paid", "expired"), null);
    assert.equal(nextOrderStatus("paid", "refunded"), "refunded");
    assert.equal(nextOrderStatus("pending", "paid"), "paid");
    assert.equal(nextOrderStatus("expired", "paid"), "paid");
    assert.equal(nextOrderStatus("expired", "pending"), null);
    assert.equal(nextOrderStatus("pending", "pending"), null);
  });

  test("gross amounts parse to whole rupiah", () => {
    assert.equal(parseGrossAmount("185000.00"), 185000);
    assert.equal(parseGrossAmount("185000.50"), null);
    assert.equal(parseGrossAmount("abc"), null);
  });
});

describe("discount code rules", () => {
  const base = { code: "1010", discountType: "percent", discountValue: 10 };
  const parse = (extra: object) =>
    discountCodeInputSchema.safeParse({ ...base, ...extra });

  test("codes are upper-cased and limited to letters, digits, - and _", () => {
    assert.equal(parse({ code: " hemat10 " }).data?.code, "HEMAT10");
    assert.equal(parse({ code: "AB" }).success, false, "too short");
    assert.equal(parse({ code: "HEMAT 10" }).success, false, "no spaces");
    assert.equal(parse({ code: "-HEMAT" }).success, false);
    assert.equal(parse({ code: "PROMO_AKHIR-TAHUN" }).success, true);
  });

  test("percent 1-99, fixed at least Rp1", () => {
    assert.equal(parse({ discountValue: 99 }).success, true);
    assert.equal(parse({ discountValue: 100 }).success, false);
    assert.equal(parse({ discountValue: 0 }).success, false);
    assert.equal(
      parse({ discountType: "fixed", discountValue: 10000 }).success,
      true
    );
    assert.equal(
      parse({ discountType: "fixed", discountValue: 0 }).success,
      false
    );
  });

  test("optional limits: product, usage count and a WIB window ending after it starts", () => {
    const parsed = parse({ productId: "", maxUses: null, startsAt: "" });
    assert.equal(parsed.data?.productId, null);
    assert.equal(parsed.data?.startsAt, null);
    assert.equal(parse({ productId: "not-a-uuid" }).success, false);
    assert.equal(parse({ maxUses: 0 }).success, false);
    assert.equal(
      parse({ startsAt: "2026-10-20T10:00", endsAt: "2026-10-19T10:00" })
        .success,
      false
    );
    assert.equal(parse({ endsAt: "31/10/2026" }).success, false);
  });

  test("checkout reads the applied code case-insensitively, empty means none", () => {
    const input = {
      productIds: [crypto.randomUUID()],
      idempotencyKey: crypto.randomUUID(),
      expectedAmount: "70200",
      buyerName: "Sari",
      buyerEmail: "sari@example.id",
    };
    assert.equal(
      checkoutInputSchema.parse({ ...input, discountCode: " 1010 " })
        .discountCode,
      "1010"
    );
    assert.equal(
      checkoutInputSchema.parse({ ...input, discountCode: "hemat10" })
        .discountCode,
      "HEMAT10"
    );
    assert.equal(
      checkoutInputSchema.parse({ ...input, discountCode: "" }).discountCode,
      null
    );
    assert.equal(checkoutInputSchema.parse(input).discountCode, null);
  });

  test("an order holds 1 to 20 different products", () => {
    const base = {
      idempotencyKey: crypto.randomUUID(),
      expectedAmount: "1000",
      buyerName: "Sari",
      buyerEmail: "sari@example.id",
    };
    const id = crypto.randomUUID();
    const parse = (productIds: string[]) =>
      checkoutInputSchema.safeParse({ ...base, productIds }).success;
    assert.equal(parse([]), false);
    assert.equal(parse([id, id]), false);
    assert.equal(
      parse(Array.from({ length: 21 }, () => crypto.randomUUID())),
      false
    );
    assert.equal(parse([id, crypto.randomUUID()]), true);
  });
});
