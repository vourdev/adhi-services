"use server";

import { eq } from "drizzle-orm";
import * as z from "zod";

import { getDb } from "@/db/client";
import { products, profiles } from "@/db/schema";
import { checkDiscountCode } from "@/server/discount-codes";
import { allowAttempt } from "@/server/rate-limit";
import { clientKey } from "@/server/session";

export type CodePreview =
  | {
      ok: true;
      code: string;
      discountAmount: number;
      finalPrice: number;
      /** Fresh checkout key: a different total is a different order, not a double submit. */
      idempotencyKey: string;
    }
  | { ok: false; error: string };

const inputSchema = z.object({
  productId: z.uuid(),
  code: z.string().trim().min(1, "Masukkan kode diskon.").max(64),
});

/**
 * Checks a discount code for one product and returns the new total. Called
 * when the buyer taps "Pakai"; the order itself checks the code again.
 * Limited per visitor so short codes cannot be guessed by trying many.
 */
export async function previewDiscountCodeAction(
  productId: unknown,
  code: unknown
): Promise<CodePreview> {
  const parsed = inputSchema.safeParse({ productId, code });
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

  const [row] = await db
    .select({ product: products, profilePublished: profiles.isPublished })
    .from(products)
    .innerJoin(profiles, eq(profiles.id, products.profileId))
    .where(eq(products.id, parsed.data.productId))
    .limit(1);
  if (!row || row.product.status !== "published" || !row.profilePublished)
    return { ok: false, error: "Produk tidak tersedia." };

  const check = await checkDiscountCode(db, {
    profileId: row.product.profileId,
    productId: row.product.id,
    priceAmount: row.product.priceAmount,
    code: parsed.data.code,
  });
  if (!check.ok) return { ok: false, error: check.message };
  return {
    ok: true,
    code: check.applied.code,
    discountAmount: check.applied.price.discountAmount,
    finalPrice: check.applied.price.finalPrice,
    idempotencyKey: crypto.randomUUID(),
  };
}
