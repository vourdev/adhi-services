import { getDb } from "@/db/client";
import { midtransRedirect } from "@/server/order-access";

/**
 * Midtrans dashboard "Error Redirect URL": the payment could not be
 * processed. Orders from this site carry their own error URL, so this is
 * the fallback, with the same routing as the finish redirect. GET or POST.
 */
async function paymentError(request: Request): Promise<Response> {
  return midtransRedirect(getDb(), request, "gagal");
}

export { paymentError as GET, paymentError as POST };
