import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { handleMidtransNotification } from "@/server/checkout";
import { gatewayForOrder, getPaymentGateway } from "@/server/payments";

/**
 * Midtrans payment notification (webhook). Every order asks Midtrans to
 * send its notifications here (X-Override-Notification), so it works even
 * when the dashboard's Payment notification URL points elsewhere; setting
 * it to {SITE_URL}/api/payments/midtrans as well does no harm.
 *
 * 200 tells Midtrans to stop; 4xx means the request itself is wrong (bad
 * JSON, bad signature); 503 and 500 make Midtrans retry later.
 */
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 64_000)
    return NextResponse.json({ result: "too_large" }, { status: 413 });

  try {
    const db = getDb();
    // Each order is verified with the key of the account it was paid into.
    const result = await handleMidtransNotification(
      db,
      (order) => (order ? gatewayForOrder(db, order) : getPaymentGateway()),
      body
    );
    if (result.httpStatus !== 200)
      console.warn("[midtrans] notification", result.httpStatus, result.result);
    return NextResponse.json(
      { result: result.result },
      { status: result.httpStatus }
    );
  } catch (error) {
    console.error("[midtrans] notification failed", error);
    return NextResponse.json({ result: "error" }, { status: 500 });
  }
}
