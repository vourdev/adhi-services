import type { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { siteUrl } from "@/lib/env";
import { formatRupiah } from "@/lib/format";
import {
  buildWhatsAppUrl,
  isValidWhatsAppNumber,
  renderWhatsAppTemplate,
} from "@/lib/whatsapp";
import { findTrackableProduct } from "@/server/analytics/ingest";
import {
  notFoundRedirect,
  trackedRedirect,
} from "@/server/analytics/track-redirect";
import { checkDiscountCode } from "@/server/discount-codes";
import { whatsappTemplateFor } from "@/server/products";
import { allowAttempt } from "@/server/rate-limit";
import { clientKey } from "@/server/session";

/**
 * "Pesan via WhatsApp": record whatsapp_checkout_clicked and open a chat
 * with the product name, price and link filled in. This is a hand-off to a
 * conversation, not a sale; it is reported separately from paid orders.
 *
 * ?kode=... adds a discount code the buyer applied on the product page. It
 * is checked again here (same per-visitor limit as the "Pakai" button), and
 * an invalid code is simply left out of the message. These orders are paid
 * outside the site, so they do not count against a code's usage limit.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = /^[0-9a-f-]{36}$/.test(id)
    ? await findTrackableProduct(getDb(), id)
    : null;
  if (!row || !row.isPublished) return notFoundRedirect(request);

  const { product, profile } = row;
  const productPath = `/${profile.username}/${product.slug}`;
  const number = product.whatsappNumber ?? profile.whatsappNumber;
  if (
    product.status !== "published" ||
    product.checkoutMethod !== "whatsapp" ||
    !number ||
    !isValidWhatsAppNumber(number)
  ) {
    return notFoundRedirect(request, productPath);
  }

  const db = getDb();
  let harga = formatRupiah(product.priceAmount);
  const code = request.nextUrl.searchParams.get("kode")?.slice(0, 64);
  if (
    code &&
    (await allowAttempt(db, `discount:${(await clientKey()) ?? "unknown"}`, {
      windowMs: 10 * 60 * 1000,
      max: 15,
    }))
  ) {
    const check = await checkDiscountCode(db, {
      profileId: product.profileId,
      productId: product.id,
      priceAmount: product.priceAmount,
      code,
    });
    if (check.ok) {
      const { price } = check.applied;
      harga = `${formatRupiah(price.finalPrice)} dengan kode diskon ${check.applied.code}, harga normal ${formatRupiah(price.listPrice)}`;
    }
  }

  const message = renderWhatsAppTemplate(whatsappTemplateFor(product), {
    produk: product.name,
    harga,
    link: `${siteUrl()}${productPath}`,
  });

  return trackedRedirect(request, buildWhatsAppUrl(number, message), {
    profileId: product.profileId,
    type: "whatsapp_checkout_clicked",
    productId: product.id,
  });
}
