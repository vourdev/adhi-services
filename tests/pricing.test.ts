import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  applyDiscount,
  describeDiscount,
  discountAmountFor,
  parseLocalWib,
  priceCart,
  toLocalWib,
} from "@/lib/pricing";

describe("discount code pricing", () => {
  test("no code: the price is charged as is", () => {
    assert.deepEqual(applyDiscount(78000, null), {
      listPrice: 78000,
      discountAmount: 0,
      finalPrice: 78000,
    });
  });

  test("percent codes round to whole rupiah", () => {
    assert.deepEqual(
      applyDiscount(78000, { discountType: "percent", discountValue: 10 }),
      { listPrice: 78000, discountAmount: 7800, finalPrice: 70200 }
    );
    assert.equal(
      discountAmountFor(24999, { discountType: "percent", discountValue: 15 }),
      3750
    );
  });

  test("fixed codes take the amount off, never more than the price", () => {
    assert.deepEqual(
      applyDiscount(78000, { discountType: "fixed", discountValue: 10000 }),
      { listPrice: 78000, discountAmount: 10000, finalPrice: 68000 }
    );
    assert.equal(
      applyDiscount(5000, { discountType: "fixed", discountValue: 10000 })
        .finalPrice,
      0
    );
  });

  test("labels read 10% or Rp10.000", () => {
    assert.equal(
      describeDiscount({ discountType: "percent", discountValue: 10 }),
      "10%"
    );
    assert.equal(
      describeDiscount({ discountType: "fixed", discountValue: 10000 }),
      "Rp10.000"
    );
  });

  test("datetime-local values are read and written in WIB", () => {
    const date = parseLocalWib("2026-10-15T23:59");
    assert.equal(date?.toISOString(), "2026-10-15T16:59:00.000Z");
    assert.equal(toLocalWib(date), "2026-10-15T23:59");
    assert.equal(parseLocalWib("15/10/2026"), null);
    assert.equal(parseLocalWib(""), null);
  });
});

describe("cart pricing", () => {
  const lines = [
    { productId: "a", listPrice: 50000 },
    { productId: "b", listPrice: 30000 },
    { productId: "c", listPrice: 19900 },
  ];
  const sum = (price: ReturnType<typeof priceCart>) =>
    price.lines.reduce((total, line) => total + line.finalPrice, 0);

  test("without a code the total is the sum of the products", () => {
    const price = priceCart(lines, null);
    assert.equal(price.subtotal, 99900);
    assert.equal(price.total, 99900);
    assert.equal(price.discountAmount, 0);
    assert.equal(price.eligible, 0);
  });

  test("a percentage comes off every product it applies to", () => {
    const price = priceCart(lines, {
      discountType: "percent",
      discountValue: 10,
      productId: null,
    });
    assert.deepEqual(
      price.lines.map((line) => line.discountAmount),
      [5000, 3000, 1990]
    );
    assert.equal(price.total, 89910);
    assert.equal(sum(price), price.total);
  });

  test("a code for one product only touches that product", () => {
    const price = priceCart(lines, {
      discountType: "percent",
      discountValue: 50,
      productId: "b",
    });
    assert.equal(price.eligible, 1);
    assert.deepEqual(
      price.lines.map((line) => line.discountAmount),
      [0, 15000, 0]
    );
  });

  test("a fixed amount comes off once, spread so the lines still add up", () => {
    const price = priceCart(lines, {
      discountType: "fixed",
      discountValue: 10000,
      productId: null,
    });
    assert.equal(price.discountAmount, 10000);
    assert.equal(price.total, 89900);
    assert.equal(sum(price), price.total);
    assert.ok(price.lines.every((line) => line.finalPrice >= 0));
  });

  test("a fixed amount never goes past the products it applies to", () => {
    const price = priceCart(lines, {
      discountType: "fixed",
      discountValue: 999999,
      productId: "c",
    });
    assert.equal(price.discountAmount, 19900);
    assert.equal(price.lines[2]?.finalPrice, 0);
  });

  test("no matching product means the code applies to nothing", () => {
    const price = priceCart(lines, {
      discountType: "fixed",
      discountValue: 5000,
      productId: "zzz",
    });
    assert.equal(price.eligible, 0);
    assert.equal(price.total, 99900);
  });
});
