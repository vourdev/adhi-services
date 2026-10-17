import { MAX_LINE_QUANTITY } from "@/lib/quantity";
import { MAX_CART_ITEMS } from "@/lib/validation";

/** The cart cookie's format, kept free of server imports so it can be tested. */

export const CART_COOKIE = "lb_cart";
export const CART_MAX_AGE_S = 30 * 24 * 60 * 60;

export type CartLine = { productId: string; quantity: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "id:qty,id:qty"; a bare id (the first cookie format) counts as one. */
export function parseCart(value: string | null | undefined): CartLine[] {
  if (!value) return [];
  const lines: CartLine[] = [];
  for (const part of value.split(",")) {
    const [productId = "", raw] = part.split(":");
    if (!UUID.test(productId) || lines.some((l) => l.productId === productId))
      continue;
    const quantity = Math.floor(Number(raw ?? "1"));
    lines.push({
      productId,
      quantity:
        Number.isFinite(quantity) && quantity >= 1
          ? Math.min(quantity, MAX_LINE_QUANTITY)
          : 1,
    });
  }
  return lines.slice(0, MAX_CART_ITEMS);
}

export function serializeCart(lines: CartLine[]): string {
  return lines
    .slice(0, MAX_CART_ITEMS)
    .map((line) => `${line.productId}:${line.quantity}`)
    .join(",");
}
