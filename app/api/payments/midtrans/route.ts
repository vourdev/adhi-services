import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { handleMidtransNotification } from "@/server/checkout";
import { gatewayForOrder, getPaymentGateway } from "@/server/payments";

/**
 * Midtrans HTTP notification endpoint. For the platform account, set it in
 * the Midtrans dashboard (Settings → Payment → Notification URL) as
 * {SITE_URL}/api/payments/midtrans. Payments on a member's own account are
 * sent here per transaction, so their dashboard needs no setup.
 */
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 64_000)
    return NextResponse.json({ error: "too_large" }, { status: 413 });

  const db = getDb();
  // Each order is verified with the key of the account it was paid into.
  const result = await handleMidtransNotification(
    db,
    (order) => (order ? gatewayForOrder(db, order) : getPaymentGateway()),
    body
  );
  return NextResponse.json(
    { result: result.result },
    { status: result.httpStatus }
  );
}
