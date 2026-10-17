"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { getDb } from "@/db/client";
import { products, profiles } from "@/db/schema";
import { MAX_CART_ITEMS } from "@/lib/validation";
import { readCart, writeCart } from "@/server/cart";

export type CartResult =
  { ok: true; count: number } | { ok: false; error: string };

const idSchema = z.uuid();

/** Adds a product that can be paid online; the cart holds products of one seller. */
export async function addToCartAction(productId: unknown): Promise<CartResult> {
  const id = idSchema.safeParse(productId);
  if (!id.success) return { ok: false, error: "Produk tidak tersedia." };
  const [row] = await getDb()
    .select({ profileId: products.profileId })
    .from(products)
    .innerJoin(profiles, eq(profiles.id, products.profileId))
    .where(
      and(
        eq(products.id, id.data),
        eq(products.status, "published"),
        eq(products.checkoutMethod, "direct"),
        eq(profiles.isPublished, true)
      )
    )
    .limit(1);
  if (!row)
    return {
      ok: false,
      error: "Produk ini tidak bisa dimasukkan ke keranjang.",
    };

  const cart = await readCart();
  if (!cart.includes(id.data)) {
    if (cart.length >= MAX_CART_ITEMS)
      return {
        ok: false,
        error: `Keranjang penuh (maksimal ${MAX_CART_ITEMS} produk).`,
      };
    cart.push(id.data);
    await writeCart(cart);
  }
  revalidatePath("/", "layout");
  return { ok: true, count: cart.length };
}

export async function removeFromCartAction(
  productId: unknown
): Promise<CartResult> {
  const id = idSchema.safeParse(productId);
  if (!id.success) return { ok: false, error: "Produk tidak ditemukan." };
  const cart = (await readCart()).filter((item) => item !== id.data);
  await writeCart(cart);
  revalidatePath("/", "layout");
  return { ok: true, count: cart.length };
}
