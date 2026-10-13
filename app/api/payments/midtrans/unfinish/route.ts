import { getDb } from "@/db/client";
import { midtransRedirect } from "@/server/order-access";

/**
 * Midtrans dashboard "Unfinish Redirect URL": the buyer went back to the
 * shop before paying. Returns them to their order page (where they can
 * continue paying) when this browser started the checkout, otherwise to a
 * general page. GET or POST.
 */
async function unfinish(request: Request): Promise<Response> {
  return midtransRedirect(getDb(), request, "belum-selesai");
}

export { unfinish as GET, unfinish as POST };
