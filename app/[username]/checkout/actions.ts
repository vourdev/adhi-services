"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { isProduction, siteUrl } from "@/lib/env";
import { checkoutInputSchema, fieldErrors } from "@/lib/validation";
import { readVisitorFromHeaders } from "@/server/analytics/visitor";
import { readCart, writeCart } from "@/server/cart";
import { startCheckout } from "@/server/checkout";
import { schedulePaymentLinkEmail } from "@/server/email";
import {
  addRecentOrder,
  RECENT_ORDERS_COOKIE,
  RECENT_ORDERS_MAX_AGE_S,
} from "@/server/order-access";
import { checkoutGateway } from "@/server/payments";
import { allowAttempt } from "@/server/rate-limit";
import { clientKey } from "@/server/session";

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

/** Creates the order and payment for one product or the cart, then sends the buyer to the payment page. */
export async function checkoutAction(
  _previous: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const agreed = formData.get("agree") === "on";
  const parsed = checkoutInputSchema.safeParse({
    items: formData.getAll("productId").map((productId, index) => ({
      productId,
      quantity: formData.getAll("quantity")[index],
    })),
    idempotencyKey: formData.get("idempotencyKey"),
    expectedAmount: formData.get("expectedAmount"),
    discountCode: formData.get("discountCode") ?? "",
    buyerName: formData.get("buyerName"),
    buyerEmail: formData.get("buyerEmail"),
    buyerPhone: formData.get("buyerPhone") ?? "",
  });
  if (!parsed.success || !agreed)
    return {
      error: "Periksa kembali data Anda.",
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(agreed
          ? {}
          : { agree: "Setujui Syarat & Ketentuan dan Kebijakan Refund." }),
      },
    };

  const db = getDb();
  const route = checkoutGateway();
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
    notificationUrl: route.notificationUrl,
  });
  if (!result.ok) return { error: result.error };

  // Lets Midtrans' Unfinish redirect, which only names the order, bring this
  // browser back to the order page (server/order-access.ts).
  const { orderId, orderCode, accessToken } = result.data;
  // Paid-for products leave the cart; anything else in it stays.
  if (formData.get("fromCart") === "1")
    await writeCart(
      (await readCart()).filter(
        (line) =>
          !parsed.data.items.some((item) => item.productId === line.productId)
      )
    );
  if (accessToken) {
    // A way back to the payment if the payment page gets closed.
    schedulePaymentLinkEmail(orderId);
    const store = await cookies();
    store.set(
      RECENT_ORDERS_COOKIE,
      addRecentOrder(
        store.get(RECENT_ORDERS_COOKIE)?.value,
        orderCode,
        accessToken
      ),
      {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: RECENT_ORDERS_MAX_AGE_S,
      }
    );
  }
  redirect(result.data.redirectUrl);
}
