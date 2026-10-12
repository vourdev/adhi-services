"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { siteUrl } from "@/lib/env";
import { checkoutInputSchema, fieldErrors } from "@/lib/validation";
import { readVisitorFromHeaders } from "@/server/analytics/visitor";
import { startCheckout } from "@/server/checkout";
import { checkoutGatewayForProfile } from "@/server/payments";
import { allowAttempt } from "@/server/rate-limit";
import { clientKey } from "@/server/session";

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

/** Creates the order and payment, then sends the buyer to the Midtrans payment page. */
export async function checkoutAction(
  _previous: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const parsed = checkoutInputSchema.safeParse({
    productId: formData.get("productId"),
    idempotencyKey: formData.get("idempotencyKey"),
    expectedAmount: formData.get("expectedAmount"),
    discountCode: formData.get("discountCode") ?? "",
    buyerName: formData.get("buyerName"),
    buyerEmail: formData.get("buyerEmail"),
    buyerPhone: formData.get("buyerPhone") ?? "",
  });
  if (!parsed.success)
    return {
      error: "Periksa kembali data Anda.",
      fieldErrors: fieldErrors(parsed.error),
    };

  const db = getDb();
  // The seller's settings decide which Midtrans account this order is paid into.
  const product = await db.query.products.findFirst({
    where: eq(products.id, parsed.data.productId),
    columns: { profileId: true },
  });
  const route = product
    ? await checkoutGatewayForProfile(db, product.profileId)
    : null;
  if (!route) return { error: "Pembayaran online belum tersedia." };

  const key = (await clientKey()) ?? "unknown";
  if (
    !(await allowAttempt(db, `checkout:${key}`, {
      windowMs: 10 * 60 * 1000,
      max: 10,
    }))
  ) {
    return {
      error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.",
    };
  }

  const result = await startCheckout(db, route.gateway, parsed.data, {
    siteUrl: siteUrl(),
    visitor: await readVisitorFromHeaders(),
    paymentAccount: route.account,
    notificationUrl: route.notificationUrl,
  });
  if (!result.ok) return { error: result.error };
  redirect(result.data.redirectUrl);
}
