import {
  and,
  asc,
  count,
  eq,
  gt,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  sum,
} from "drizzle-orm";

import type { Database, Transaction } from "@/db/client";
import {
  discountCodes,
  orders,
  products,
  type DiscountCode,
} from "@/db/schema";
import {
  applyDiscount,
  parseLocalWib,
  type PriceBreakdown,
} from "@/lib/pricing";
import { fail, isUniqueViolation, ok, type Result } from "@/lib/result";
import {
  DISCOUNT_CODE_PATTERN,
  normalizeDiscountCode,
  type DiscountCodeInput,
} from "@/lib/validation";

/**
 * Discount codes. The owner creates codes such as "1010" (10% off) or
 * "HEMAT10K" (Rp10.000 off); a buyer types one at checkout or before
 * ordering through WhatsApp. The lookup and the price both happen here, on
 * the server, when the code is applied and again when the order is created.
 */

/**
 * How long an unpaid order holds one use of a limited code. Matches the
 * default Midtrans Snap payment window, so an abandoned checkout gives its
 * use back once the buyer can no longer pay.
 */
export const CODE_HOLD_MS = 24 * 60 * 60 * 1000;

export type CodeRejection =
  | "not_found"
  | "not_started"
  | "ended"
  | "used_up"
  | "wrong_product"
  | "too_large";

export const CODE_REJECTION_MESSAGES: Record<CodeRejection, string> = {
  not_found: "Kode diskon tidak ditemukan atau sudah tidak aktif.",
  not_started: "Kode diskon ini belum bisa dipakai.",
  ended: "Masa berlaku kode diskon ini sudah habis.",
  used_up: "Kuota kode diskon ini sudah habis.",
  wrong_product: "Kode diskon ini tidak berlaku untuk produk ini.",
  too_large: "Kode diskon ini tidak berlaku untuk produk ini.",
};

export type AppliedCode = {
  id: string;
  code: string;
  maxUses: number | null;
  price: PriceBreakdown;
};

export type CodeCheck =
  | { ok: true; applied: AppliedCode }
  | { ok: false; reason: CodeRejection; message: string };

function reject(reason: CodeRejection): CodeCheck {
  return { ok: false, reason, message: CODE_REJECTION_MESSAGES[reason] };
}

/** Uses that count against maxUses: paid orders, plus unpaid ones still inside the payment window. */
export async function countCodeUses(
  db: Database | Transaction,
  codeId: string,
  nowMs = Date.now()
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .where(
      and(
        eq(orders.discountCodeId, codeId),
        or(
          eq(orders.status, "paid"),
          and(
            eq(orders.status, "pending"),
            gt(orders.createdAt, new Date(nowMs - CODE_HOLD_MS))
          )
        )
      )
    );
  return row?.value ?? 0;
}

/** Looks a code up for one product and computes the price with it. */
export async function checkDiscountCode(
  db: Database | Transaction,
  input: {
    profileId: string;
    productId: string;
    priceAmount: number;
    code: string;
  },
  nowMs = Date.now()
): Promise<CodeCheck> {
  const code = normalizeDiscountCode(input.code);
  if (!DISCOUNT_CODE_PATTERN.test(code)) return reject("not_found");

  const row = await db.query.discountCodes.findFirst({
    where: and(
      eq(discountCodes.profileId, input.profileId),
      eq(discountCodes.code, code)
    ),
  });
  if (!row || !row.isActive) return reject("not_found");
  if (row.startsAt && row.startsAt.getTime() > nowMs)
    return reject("not_started");
  if (row.endsAt && row.endsAt.getTime() <= nowMs) return reject("ended");
  if (row.productId && row.productId !== input.productId)
    return reject("wrong_product");

  const price = applyDiscount(input.priceAmount, row);
  // A code never makes a product free: Midtrans cannot charge Rp0.
  if (price.discountAmount < 1 || price.finalPrice < 1)
    return reject("too_large");

  if (
    row.maxUses !== null &&
    (await countCodeUses(db, row.id, nowMs)) >= row.maxUses
  ) {
    return reject("used_up");
  }
  return {
    ok: true,
    applied: { id: row.id, code: row.code, maxUses: row.maxUses, price },
  };
}

/** True when at least one active code could apply to this product right now. Decides whether the code field is shown. */
export async function hasUsableCodes(
  db: Database,
  profileId: string,
  productId: string,
  nowMs = Date.now()
): Promise<boolean> {
  const now = new Date(nowMs);
  const row = await db
    .select({ id: discountCodes.id })
    .from(discountCodes)
    .where(
      and(
        eq(discountCodes.profileId, profileId),
        eq(discountCodes.isActive, true),
        or(
          isNull(discountCodes.productId),
          eq(discountCodes.productId, productId)
        ),
        or(isNull(discountCodes.startsAt), lte(discountCodes.startsAt, now)),
        or(isNull(discountCodes.endsAt), gt(discountCodes.endsAt, now))
      )
    )
    .limit(1);
  return row.length > 0;
}

// ------------------------------------------------------------------ admin

export type CodeStatus =
  "active" | "inactive" | "scheduled" | "ended" | "used_up";

export function codeStatus(
  code: Pick<DiscountCode, "isActive" | "startsAt" | "endsAt" | "maxUses">,
  paidUses: number,
  nowMs = Date.now()
): CodeStatus {
  if (!code.isActive) return "inactive";
  if (code.endsAt && code.endsAt.getTime() <= nowMs) return "ended";
  if (code.maxUses !== null && paidUses >= code.maxUses) return "used_up";
  if (code.startsAt && code.startsAt.getTime() > nowMs) return "scheduled";
  return "active";
}

export type DiscountCodeRow = DiscountCode & {
  productName: string | null;
  /** Paid orders that used the code. */
  paidUses: number;
  /** Rupiah taken off across those paid orders. */
  discountTotal: number;
};

export async function listDiscountCodes(
  db: Database,
  profileId: string
): Promise<DiscountCodeRow[]> {
  const [codes, usage] = await Promise.all([
    db
      .select({ code: discountCodes, productName: products.name })
      .from(discountCodes)
      .leftJoin(products, eq(products.id, discountCodes.productId))
      .where(eq(discountCodes.profileId, profileId))
      .orderBy(sql`${discountCodes.isActive} desc`, asc(discountCodes.code)),
    db
      .select({
        codeId: orders.discountCodeId,
        paidUses: count(),
        discountTotal: sum(orders.discountAmount),
      })
      .from(orders)
      .where(
        and(
          eq(orders.profileId, profileId),
          eq(orders.status, "paid"),
          isNotNull(orders.discountCodeId)
        )
      )
      .groupBy(orders.discountCodeId),
  ]);
  const byCode = new Map(usage.map((row) => [row.codeId, row]));
  return codes.map(({ code, productName }) => {
    const used = byCode.get(code.id);
    return {
      ...code,
      productName,
      paidUses: used?.paidUses ?? 0,
      discountTotal: Number(used?.discountTotal ?? 0),
    };
  });
}

/** Products to choose from when limiting a code to one product. */
export async function listProductOptions(db: Database, profileId: string) {
  return db
    .select({
      id: products.id,
      name: products.name,
      priceAmount: products.priceAmount,
    })
    .from(products)
    .where(eq(products.profileId, profileId))
    .orderBy(asc(products.name));
}

export async function getDiscountCode(
  db: Database,
  profileId: string,
  id: string
): Promise<DiscountCode | undefined> {
  return db.query.discountCodes.findFirst({
    where: and(
      eq(discountCodes.id, id),
      eq(discountCodes.profileId, profileId)
    ),
  });
}

async function toRow(
  db: Database,
  profileId: string,
  input: DiscountCodeInput
): Promise<Result<Omit<typeof discountCodes.$inferInsert, "profileId">>> {
  if (input.productId) {
    // The product must belong to this profile.
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, input.productId),
        eq(products.profileId, profileId)
      ),
      columns: { id: true, priceAmount: true },
    });
    if (!product)
      return fail("Periksa kembali isian kode.", {
        productId: "Produk tidak ditemukan.",
      });
    if (
      input.discountType === "fixed" &&
      input.discountValue >= product.priceAmount
    )
      return fail("Periksa kembali isian kode.", {
        discountValue: "Potongan harus lebih kecil dari harga produk.",
      });
  }
  return ok({
    code: input.code,
    discountType: input.discountType,
    discountValue: input.discountValue,
    productId: input.productId,
    maxUses: input.maxUses,
    startsAt: parseLocalWib(input.startsAt),
    endsAt: parseLocalWib(input.endsAt),
    isActive: input.isActive,
  });
}

const DUPLICATE_CODE = fail("Kode sudah ada.", {
  code: "Kode ini sudah dipakai kode diskon lain.",
});

export async function createDiscountCode(
  db: Database,
  profileId: string,
  input: DiscountCodeInput
): Promise<Result<{ id: string }>> {
  const row = await toRow(db, profileId, input);
  if (!row.ok) return row;
  try {
    const [created] = await db
      .insert(discountCodes)
      .values({ ...row.data, profileId })
      .returning({ id: discountCodes.id });
    return created ? ok({ id: created.id }) : fail("Kode gagal disimpan.");
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE_CODE;
    throw error;
  }
}

/** Orders already placed keep the discount they got; edits only affect new orders. */
export async function updateDiscountCode(
  db: Database,
  profileId: string,
  id: string,
  input: DiscountCodeInput
): Promise<Result> {
  if (!(await getDiscountCode(db, profileId, id)))
    return fail("Kode diskon tidak ditemukan.");
  const row = await toRow(db, profileId, input);
  if (!row.ok) return row;
  try {
    await db
      .update(discountCodes)
      .set(row.data)
      .where(
        and(eq(discountCodes.id, id), eq(discountCodes.profileId, profileId))
      );
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE_CODE;
    throw error;
  }
}

/** Orders that used the code keep its text and amount; only the link to the code is cleared. */
export async function deleteDiscountCode(
  db: Database,
  profileId: string,
  id: string
): Promise<Result> {
  const deleted = await db
    .delete(discountCodes)
    .where(
      and(eq(discountCodes.id, id), eq(discountCodes.profileId, profileId))
    )
    .returning({ id: discountCodes.id });
  return deleted.length > 0 ? ok() : fail("Kode diskon tidak ditemukan.");
}
