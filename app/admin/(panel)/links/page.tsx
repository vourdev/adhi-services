import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { products } from "@/db/schema";
import {
  describeRange,
  parseRange,
  rangeToSearchParams,
} from "@/lib/analytics/range";
import { rate } from "@/lib/analytics/metrics";
import { siteUrl } from "@/lib/env";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";
import { adminContext } from "@/server/admin";
import { getClicksByLink, getOverviewTotals } from "@/server/analytics/queries";
import { listLinks } from "@/server/profile";

import { PageHeader } from "../../_components/page-header";
import { LinksManager } from "./_components/links-manager";

export const metadata: Metadata = { title: "Links" };

export default async function LinksPage(): Promise<ReactNode> {
  const { db, owner, profileId } = await adminContext();
  const range = parseRange({ range: "30d" });
  const [links, clicks, totals, catalog] = await Promise.all([
    listLinks(db, profileId),
    getClicksByLink(db, profileId, range),
    getOverviewTotals(db, profileId, range),
    db
      .select({ id: products.id, name: products.name, status: products.status })
      .from(products)
      .where(eq(products.profileId, profileId)),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Links"
        description="Atur link, judul bagian, dan kartu produk yang tampil di profil publik. Perubahan langsung terlihat."
      />
      <LinksManager
        links={links.map((link) => {
          const count = clicks.get(link.id) ?? 0;
          return {
            id: link.id,
            kind: link.kind,
            title: link.title,
            url: link.url,
            message: link.message,
            description: link.description,
            thumbnailUrl: link.thumbnailUrl,
            category: link.category,
            layout: link.layout,
            isActive: link.isActive,
            product: link.product,
            clicks: count,
            ctr: rate(count, totals.profileViews),
          };
        })}
        products={catalog}
        whatsappReady={Boolean(
          owner.profile.whatsappNumber &&
          isValidWhatsAppNumber(owner.profile.whatsappNumber)
        )}
        publicUrl={`${siteUrl()}/${owner.profile.username}`}
        rangeLabel={describeRange(range)}
        rangeQuery={rangeToSearchParams(range)}
      />
    </div>
  );
}
