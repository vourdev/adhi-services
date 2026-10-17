import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { MAX_CART_ITEMS } from "@/lib/validation";

/**
 * The buyer's cart: product ids in a cookie, so the server renders the cart
 * count and the checkout list directly. No account and nothing personal is
 * stored; the cookie only holds ids. Prices are always read fresh.
 */

export const CART_COOKIE = "lb_cart";
export const CART_MAX_AGE_S = 30 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCart(value: string | null | undefined): string[] {
  if (!value) return [];
  const ids = value.split(",").filter((id) => UUID.test(id));
  return [...new Set(ids)].slice(0, MAX_CART_ITEMS);
}

export async function readCart(): Promise<string[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

export async function writeCart(ids: string[]): Promise<void> {
  const store = await cookies();
  if (ids.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, ids.slice(0, MAX_CART_ITEMS).join(","), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_MAX_AGE_S,
  });
}

/** Cart products that can still be bought online from this profile, in cart order. */
export async function cartProducts(profileId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await getDb()
    .select()
    .from(products)
    .where(
      and(
        inArray(products.id, ids),
        eq(products.profileId, profileId),
        eq(products.status, "published"),
        eq(products.checkoutMethod, "direct")
      )
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
