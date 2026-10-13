import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { handleMidtransRecurringNotification } from "@/server/checkout";
import { gatewayForOrder, getPaymentGateway } from "@/server/payments";

/**
 * Midtrans "Recurring payment notification URL". The site has no
 * subscriptions; a charge notification is still verified and handled like
 * a payment notification, anything else is acknowledged and ignored.
 */
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 64_000)
    return NextResponse.json({ result: "too_large" }, { status: 413 });

  try {
    const db = getDb();
    const result = await handleMidtransRecurringNotification(
      db,
      (order) => (order ? gatewayForOrder(db, order) : getPaymentGateway()),
      body
    );
    console.info("[midtrans] recurring notification", result.result);
    return NextResponse.json(
      { result: result.result },
      { status: result.httpStatus }
    );
  } catch (error) {
    console.error("[midtrans] recurring notification failed", error);
    return NextResponse.json({ result: "error" }, { status: 500 });
  }
}
