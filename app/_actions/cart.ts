"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { getDb } from "@/db/client";
import { products, profiles } from "@/db/schema";
import {
  MAX_LINE_QUANTITY,
  quantityLimits,
  quantityProblem,
} from "@/lib/quantity";
import { MAX_CART_ITEMS } from "@/lib/validation";
import { readCart, writeCart } from "@/server/cart";

/**
 * Cart changes. Every result carries a message and its tone, so the page
 * can show it as a toast: a broken rule (over the maximum, cart full) is a
 * warning, a product that can no longer be bought is an error.
 */
export type CartResult =
  | {
      ok: true;
      tone: "success" | "info";
      message: string;
      /** Products (lines) in the cart now. */
      count: number;
      /** Units of this product in the cart now. */
      quantity: number;
    }
  | { ok: false; tone: "warning" | "error"; message: string };

const idSchema = z.uuid();
const quantitySchema = z.number().int().min(0).max(MAX_LINE_QUANTITY);

async function sellable(productId: string) {
  const [row] = await getDb()
    .select({ product: products })
    .from(products)
    .innerJoin(profiles, eq(profiles.id, products.profileId))
    .where(
      and(
        eq(products.id, productId),
        eq(products.status, "published"),
        eq(profiles.isPublished, true)
      )
    )
    .limit(1);
  return row?.product ?? null;
}

const UNAVAILABLE: CartResult = {
  ok: false,
  tone: "error",
  message: "Produk ini sudah tidak tersedia.",
};

/** One more unit, or the minimum when the product is not in the cart yet. */
export async function addToCartAction(productId: unknown): Promise<CartResult> {
  const id = idSchema.safeParse(productId);
  if (!id.success) return UNAVAILABLE;
  const product = await sellable(id.data);
  if (!product) return UNAVAILABLE;
  if (product.checkoutMethod !== "direct")
    return {
      ok: false,
      tone: "warning",
      message: "Produk ini dipesan lewat WhatsApp, tidak lewat keranjang.",
    };

  const limits = quantityLimits(product);
  const cart = await readCart();
  const line = cart.find((item) => item.productId === id.data);
  if (!line && cart.length >= MAX_CART_ITEMS)
    return {
      ok: false,
      tone: "warning",
      message: `Keranjang penuh. Maksimal ${MAX_CART_ITEMS} produk per transaksi.`,
    };
  const quantity = line ? line.quantity + 1 : limits.min;
  const problem = quantityProblem(product.name, quantity, limits);
  if (problem) return { ok: false, tone: "warning", message: problem };

  if (line) line.quantity = quantity;
  else cart.push({ productId: id.data, quantity });
  await writeCart(cart);
  revalidatePath("/", "layout");
  return {
    ok: true,
    tone: "success",
    message:
      quantity > 1
        ? `${product.name} di keranjang sekarang ${quantity}.`
        : `${product.name} masuk keranjang.`,
    count: cart.length,
    quantity,
  };
}

/** Sets the units of a product in the cart; 0 removes it. */
export async function setCartQuantityAction(
  productId: unknown,
  quantity: unknown
): Promise<CartResult> {
  const id = idSchema.safeParse(productId);
  const amount = quantitySchema.safeParse(quantity);
  if (!id.success || !amount.success) return UNAVAILABLE;
  const cart = await readCart();
  if (amount.data === 0) {
    const next = cart.filter((item) => item.productId !== id.data);
    await writeCart(next);
    revalidatePath("/", "layout");
    return {
      ok: true,
      tone: "info",
      message: "Produk dihapus dari keranjang.",
      count: next.length,
      quantity: 0,
    };
  }
  const product = await sellable(id.data);
  if (!product || product.checkoutMethod !== "direct") return UNAVAILABLE;
  const problem = quantityProblem(
    product.name,
    amount.data,
    quantityLimits(product)
  );
  if (problem) return { ok: false, tone: "warning", message: problem };

  const line = cart.find((item) => item.productId === id.data);
  if (line) line.quantity = amount.data;
  else if (cart.length < MAX_CART_ITEMS)
    cart.push({ productId: id.data, quantity: amount.data });
  else
    return {
      ok: false,
      tone: "warning",
      message: `Keranjang penuh. Maksimal ${MAX_CART_ITEMS} produk per transaksi.`,
    };
  await writeCart(cart);
  revalidatePath("/", "layout");
  return {
    ok: true,
    tone: "success",
    message: `Jumlah ${product.name} diubah menjadi ${amount.data}.`,
    count: cart.length,
    quantity: amount.data,
  };
}
