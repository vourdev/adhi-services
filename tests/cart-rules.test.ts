import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  clampQuantity,
  describeLimits,
  quantityLimits,
  quantityProblem,
} from "@/lib/quantity";
import { parseCart, serializeCart } from "@/lib/cart-cookie";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("quantity limits", () => {
  test("no maximum means up to 99; the maximum never falls below the minimum", () => {
    assert.deepEqual(quantityLimits({ minQuantity: 1, maxQuantity: null }), {
      min: 1,
      max: 99,
    });
    assert.deepEqual(quantityLimits({ minQuantity: 3, maxQuantity: 2 }), {
      min: 3,
      max: 3,
    });
  });

  test("going over the maximum or under the minimum is explained", () => {
    const limits = { min: 1, max: 1 };
    assert.equal(
      quantityProblem("Template Portfolio", 2, limits),
      "Maksimal 1 per transaksi untuk Template Portfolio."
    );
    assert.equal(
      quantityProblem("Kelas", 1, { min: 2, max: 5 }),
      "Minimal pembelian Kelas adalah 2."
    );
    assert.equal(quantityProblem("Kelas", 3, { min: 2, max: 5 }), null);
  });

  test("a cart quantity is brought back within the limits", () => {
    assert.equal(clampQuantity(7, { min: 1, max: 3 }), 3);
    assert.equal(clampQuantity(0, { min: 2, max: 3 }), 2);
  });

  test("the product page says what the limits are", () => {
    assert.equal(describeLimits({ min: 1, max: 99 }), null);
    assert.equal(
      describeLimits({ min: 1, max: 1 }),
      "Maksimal 1 per transaksi"
    );
    assert.equal(
      describeLimits({ min: 2, max: 99 }),
      "Minimal 2 per transaksi"
    );
    assert.equal(
      describeLimits({ min: 2, max: 4 }),
      "Minimal 2, maksimal 4 per transaksi"
    );
  });
});

describe("cart cookie", () => {
  test("ids with quantities round-trip; old bare ids count as one", () => {
    assert.deepEqual(parseCart(`${A}:3,${B}`), [
      { productId: A, quantity: 3 },
      { productId: B, quantity: 1 },
    ]);
    assert.equal(serializeCart([{ productId: A, quantity: 2 }]), `${A}:2`);
  });

  test("junk, duplicates and silly quantities are dropped or fixed", () => {
    assert.deepEqual(parseCart(`nope,${A}:0,${A}:5,${B}:500`), [
      { productId: A, quantity: 1 },
      { productId: B, quantity: 99 },
    ]);
  });
});
