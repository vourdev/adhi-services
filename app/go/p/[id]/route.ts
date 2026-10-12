import type { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { findTrackableProduct } from "@/server/analytics/ingest";
import {
  notFoundRedirect,
  trackedRedirect,
} from "@/server/analytics/track-redirect";

/** Product card click on the profile: record product_click, then open the product page. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = /^[0-9a-f-]{36}$/.test(id)
    ? await findTrackableProduct(getDb(), id)
    : null;
  if (!row || !row.isPublished) return notFoundRedirect(request);
  if (row.product.status !== "published")
    return notFoundRedirect(request, `/${row.username}`);

  return trackedRedirect(request, `/${row.username}/${row.product.slug}`, {
    profileId: row.product.profileId,
    type: "product_click",
    productId: row.product.id,
  });
}
