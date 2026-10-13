import { NextResponse } from "next/server";

/**
 * Midtrans "Account linking notification URL" (GoPay tokenization). The
 * site does not link buyers' GoPay accounts, so a notification is only
 * acknowledged: 200 keeps Midtrans from retrying, and nothing is stored.
 */
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 64_000)
    return NextResponse.json({ result: "too_large" }, { status: 413 });
  try {
    JSON.parse(body);
  } catch {
    return NextResponse.json({ result: "invalid_json" }, { status: 400 });
  }
  console.info("[midtrans] account linking notification ignored");
  return NextResponse.json({ result: "ignored:not_used" });
}
