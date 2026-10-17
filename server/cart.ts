import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import {
  CART_COOKIE,
  CART_MAX_AGE_S,
  type CartLine,
  parseCart,
  serializeCart,
} from "@/lib/cart-cookie";
import { clampQuantity, quantityLimits } from "@/lib/quantity";

export { parseCart, type CartLine } from "@/lib/cart-cookie";

/**
 * The buyer's cart: product ids and quantities in a cookie, so the server
 * renders the cart count and the checkout list directly. No account and
 * nothing personal is stored. Prices and limits are always read fresh.
 */

export async function readCart(): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, serializeCart(lines), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_MAX_AGE_S,
  });
}

/**
 * Cart products that can still be bought online from this profile, in cart
 * order, each with its quantity brought within the product's current limits.
 */
export async function cartProducts(profileId: string, lines: CartLine[]) {
  if (lines.length === 0) return [];
  const rows = await getDb()
    .select()
    .from(products)
    .where(
      and(
        inArray(
          products.id,
          lines.map((line) => line.productId)
        ),
        eq(products.profileId, profileId),
        eq(products.status, "published"),
        eq(products.checkoutMethod, "direct")
      )
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return lines.flatMap((line) => {
    const product = byId.get(line.productId);
    if (!product) return [];
    const limits = quantityLimits(product);
    return [
      { product, limits, quantity: clampQuantity(line.quantity, limits) },
    ];
  });
}
