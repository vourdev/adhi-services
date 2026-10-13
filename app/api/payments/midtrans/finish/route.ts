import { getDb } from "@/db/client";
import { midtransRedirect } from "@/server/order-access";

/**
 * Midtrans dashboard "Finish Redirect URL". Orders from this site carry
 * their own finish URL, so this is the fallback: it returns the buyer to
 * their order page when this browser started the checkout, otherwise to a
 * general thank-you page. GET or POST (some payment methods post back).
 */
async function finish(request: Request): Promise<Response> {
  return midtransRedirect(getDb(), request, "selesai");
}

export { finish as GET, finish as POST };
