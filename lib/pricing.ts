import type { DiscountCodeType } from "@/lib/domain";
import { formatRupiah } from "@/lib/format";

/**
 * Discount-code arithmetic. A product has one normal price; a discount code
 * takes a percentage (1-99) or a fixed rupiah amount off it. The server
 * computes the result when the buyer applies a code and again when the
 * order is created, so the browser never decides the price.
 */

export type CodeDiscount = {
  discountType: DiscountCodeType;
  discountValue: number;
};

export type PriceBreakdown = {
  /** Normal price. */
  listPrice: number;
  /** Rupiah taken off by the code (0 without one). */
  discountAmount: number;
  /** Price to charge. */
  finalPrice: number;
};

/** Rupiah a code takes off a price. Percentages round to whole rupiah. */
export function discountAmountFor(
  price: number,
  discount: CodeDiscount
): number {
  if (discount.discountType === "percent") {
    const percent = Math.min(Math.max(discount.discountValue, 0), 100);
    return Math.min(price, Math.round((price * percent) / 100));
  }
  return Math.min(price, Math.max(discount.discountValue, 0));
}

export function applyDiscount(
  price: number,
  discount: CodeDiscount | null
): PriceBreakdown {
  const discountAmount = discount ? discountAmountFor(price, discount) : 0;
  return {
    listPrice: price,
    discountAmount,
    finalPrice: price - discountAmount,
  };
}

export type CartLine = { productId: string; listPrice: number };

/** A code as the cart sees it: limited to one product, or to every product (null). */
export type CartCode = CodeDiscount & { productId: string | null };

export type PricedLine = CartLine & {
  /** Rupiah the code took off this product. */
  discountAmount: number;
  /** What is charged for this product. */
  finalPrice: number;
};

export type CartPrice = {
  lines: PricedLine[];
  subtotal: number;
  discountAmount: number;
  total: number;
  /** How many products the code applies to (0 without a code). */
  eligible: number;
};

/**
 * Prices several products paid together. A percentage code comes off each
 * product it applies to. A fixed code comes off once, spread over those
 * products in proportion to their price (the last one takes the rounding),
 * so every product line still adds up to the total the gateway charges.
 */
export function priceCart(lines: CartLine[], code: CartCode | null): CartPrice {
  const eligibleIndexes = code
    ? lines.flatMap((line, index) =>
        code.productId === null || code.productId === line.productId
          ? [index]
          : []
      )
    : [];
  const discounts = lines.map(() => 0);
  if (code && code.discountType === "percent") {
    for (const index of eligibleIndexes)
      discounts[index] = discountAmountFor(lines[index]!.listPrice, code);
  } else if (code && eligibleIndexes.length > 0) {
    const eligibleTotal = eligibleIndexes.reduce(
      (sum, index) => sum + lines[index]!.listPrice,
      0
    );
    const amount = Math.min(Math.max(code.discountValue, 0), eligibleTotal);
    let left = amount;
    eligibleIndexes.forEach((index, position) => {
      const price = lines[index]!.listPrice;
      const share =
        position === eligibleIndexes.length - 1
          ? Math.min(left, price)
          : Math.floor((amount * price) / eligibleTotal);
      discounts[index] = share;
      left -= share;
    });
  }
  const priced = lines.map((line, index) => ({
    ...line,
    discountAmount: discounts[index]!,
    finalPrice: line.listPrice - discounts[index]!,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.listPrice, 0);
  const discountAmount = discounts.reduce((sum, value) => sum + value, 0);
  return {
    lines: priced,
    subtotal,
    discountAmount,
    total: subtotal - discountAmount,
    eligible: eligibleIndexes.length,
  };
}

/** "10%" or "Rp10.000". */
export function describeDiscount(discount: CodeDiscount): string {
  return discount.discountType === "percent"
    ? `${discount.discountValue}%`
    : formatRupiah(discount.discountValue);
}

/** "YYYY-MM-DDTHH:mm" from an <input type="datetime-local">, read as WIB (UTC+7). */
export function parseLocalWib(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The reverse of parseLocalWib, for filling the input. */
export function toLocalWib(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}
