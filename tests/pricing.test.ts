import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  applyDiscount,
  describeDiscount,
  discountAmountFor,
  parseLocalWib,
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
