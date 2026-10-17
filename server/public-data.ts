import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/db/client";
import { profiles } from "@/db/schema";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";

import { paymentsStatus } from "./payments";
import { getProductBySlug } from "./products";
import { getPublicProfile, toPublicProduct } from "./profile";
import { getCurrentOwner } from "./session";

/**
 * Per-request loaders for public pages, memoised so generateMetadata and
 * the page share one query. The signed-in owner can preview an unpublished
 * profile or a draft product; everyone else gets a 404.
 */

export const loadProfile = cache(async (username: string) => {
  const owner = await getCurrentOwner();
  const isOwner = owner?.profile.username === username;
  const profile = await getPublicProfile(getDb(), username, {
    includeUnpublished: isOwner,
  });
  return profile ? { profile, isOwner } : null;
});

export const loadProduct = cache(async (username: string, slug: string) => {
  const loaded = await loadProfile(username);
  if (!loaded) return null;
  const db = getDb();
  const product = await getProductBySlug(db, loaded.profile.id, slug);
  if (!product) return null;
  if (product.status !== "published" && !loaded.isOwner) return null;

  // The number itself stays on the server; the page only needs to know whether ordering works.
  const owner = await db.query.profiles.findFirst({
    where: eq(profiles.id, loaded.profile.id),
    columns: { whatsappNumber: true },
  });
  const number = product.whatsappNumber ?? owner?.whatsappNumber ?? null;
  const whatsappReady = Boolean(number && isValidWhatsAppNumber(number));

  return {
    ...loaded,
    product: toPublicProduct(product),
    whatsappReady,
    paymentsReady: paymentsStatus().ready,
  };
});
