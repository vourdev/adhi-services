import { and, eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { getDb } from "@/db/client";
import { products, profiles } from "@/db/schema";
import { siteUrl } from "@/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const db = getDb();
  const base = siteUrl();
  const published = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      updatedAt: profiles.updatedAt,
    })
    .from(profiles)
    .where(eq(profiles.isPublished, true));
  const entries: MetadataRoute.Sitemap = [
    "/syarat-ketentuan",
    "/kebijakan-refund",
    "/faq",
    "/kontak",
    "/privasi",
  ].map((path) => ({ url: `${base}${path}`, priority: 0.3 }));

  for (const profile of published) {
    entries.push({
      url: `${base}/${profile.username}`,
      lastModified: profile.updatedAt,
      changeFrequency: "weekly",
      priority: 1,
    });
    const items = await db
      .select({ slug: products.slug, updatedAt: products.updatedAt })
      .from(products)
      .where(
        and(
          eq(products.profileId, profile.id),
          eq(products.status, "published")
        )
      );
    for (const item of items) {
      entries.push({
        url: `${base}/${profile.username}/${item.slug}`,
        lastModified: item.updatedAt,
        priority: 0.7,
      });
    }
  }
  return entries;
}
