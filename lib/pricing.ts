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
