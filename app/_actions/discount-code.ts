"use server";

import { and, eq, inArray } from "drizzle-orm";
import * as z from "zod";

import { getDb } from "@/db/client";
import { products, profiles } from "@/db/schema";
import { MAX_LINE_QUANTITY } from "@/lib/quantity";
import { MAX_CART_ITEMS } from "@/lib/validation";
import { checkDiscountCode } from "@/server/discount-codes";
import { allowAttempt } from "@/server/rate-limit";
import { clientKey } from "@/server/session";

export type CodePreview =
  | {
      ok: true;
      code: string;
      discountAmount: number;
      finalPrice: number;
      /** Rupiah off per product id, for the per-line prices in the cart. */
      lineDiscounts: Record<string, number>;
      /** Fresh checkout key: a different total is a different order, not a double submit. */
      idempotencyKey: string;
    }
  | { ok: false; error: string };

const inputSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
      })
    )
    .min(1)
    .max(MAX_CART_ITEMS),
  code: z.string().trim().min(1, "Masukkan kode diskon.").max(64),
});

/**
 * Checks a discount code for the products being bought and returns the new total. Called
 * when the buyer taps "Pakai"; the order itself checks the code again.
 * Limited per visitor so short codes cannot be guessed by trying many.
 */
export async function previewDiscountCodeAction(
  items: unknown,
  code: unknown
): Promise<CodePreview> {
  const parsed = inputSchema.safeParse({ items, code });
  if (!parsed.success)
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.path[0] === "code"
          ? (parsed.error.issues[0]?.message ?? "Kode tidak valid.")
          : "Produk tidak tersedia.",
    };

  const db = getDb();
  const key = (await clientKey()) ?? "unknown";
  if (
    !(await allowAttempt(db, `discount:${key}`, {
      windowMs: 10 * 60 * 1000,
      max: 15,
    }))
  ) {
    return {
      ok: false,
      error: "Terlalu banyak percobaan kode. Coba lagi dalam beberapa menit.",
    };
  }

  const quantities = new Map(
    parsed.data.items.map((item) => [item.productId, item.quantity])
  );
  const ids = [...quantities.keys()];
  const rows = await db
    .select({ product: products })
    .from(products)
    .innerJoin(profiles, eq(profiles.id, products.profileId))
    .where(
      and(
        inArray(products.id, ids),
        eq(products.status, "published"),
        eq(profiles.isPublished, true)
      )
    );
  const profileId = rows[0]?.product.profileId;
  if (
    !profileId ||
    rows.length !== ids.length ||
    rows.some((row) => row.product.profileId !== profileId)
  )
    return { ok: false, error: "Produk tidak tersedia." };
  const byId = new Map(rows.map((row) => [row.product.id, row.product]));

  const check = await checkDiscountCode(db, {
    profileId,
    items: ids.map((id) => ({
      productId: id,
      listPrice: byId.get(id)!.priceAmount * quantities.get(id)!,
    })),
    code: parsed.data.code,
  });
  if (!check.ok) return { ok: false, error: check.message };
  const { price } = check.applied;
  return {
    ok: true,
    code: check.applied.code,
    discountAmount: price.discountAmount,
    finalPrice: price.total,
    lineDiscounts: Object.fromEntries(
      price.lines.map((line) => [line.productId, line.discountAmount])
    ),
    idempotencyKey: crypto.randomUUID(),
  };
}
