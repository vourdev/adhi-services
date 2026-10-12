import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { parseRange } from "@/lib/analytics/range";
import { blobStorageEnabled, siteUrl } from "@/lib/env";
import { formatNumber, formatRupiah } from "@/lib/format";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";
import { adminContext, ownerPayments } from "@/server/admin";
import { getProductAnalytics } from "@/server/analytics/queries";
import { getProduct, isOnProfile } from "@/server/products";

import { KpiStrip } from "../../../_components/analytics/kpi-strip";
import { PageHeader } from "../../../_components/page-header";
import { toFormValues } from "../_components/form-values";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = { title: "Edit produk" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db, owner, profileId } = await adminContext();
  const product = await getProduct(db, profileId, id);
  if (!product) notFound();

  const [onProfile, analytics] = await Promise.all([
    isOnProfile(db, profileId, id),
    getProductAnalytics(db, profileId, parseRange({ range: "30d" })),
  ]);
  const stats = analytics.rows.find((row) => row.productId === id);
  const payments = ownerPayments(owner);

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/products">
          <ArrowLeft />
          Semua produk
        </Link>
      </Button>
      <PageHeader
        title={product.name}
        description="Statistik 30 hari terakhir dan pengaturan produk."
      />
      {stats ? (
        <KpiStrip
          items={[
            { label: "Tayangan", value: stats.views, change: null },
            {
              label: "Klik kartu di profil",
              value: stats.clicks,
              change: null,
            },
            product.checkoutMethod === "whatsapp"
              ? {
                  label: "Klik pesan via WhatsApp",
                  value: stats.whatsappClicks,
                  change: null,
                  hint: "Pembukaan chat, bukan penjualan.",
                }
              : {
                  label: "Transaksi lunas",
                  value: stats.paidOrders,
                  change: null,
                  formatted: `${formatNumber(stats.paidOrders)} · ${formatRupiah(stats.revenue)}`,
                },
          ]}
        />
      ) : null}
      <ProductForm
        productId={product.id}
        initialValues={toFormValues(product, onProfile)}
        username={owner.profile.username}
        siteUrl={siteUrl()}
        profileTheme={owner.profile.theme}
        profileAccent={owner.profile.accent}
        profileWhatsappSet={Boolean(
          owner.profile.whatsappNumber &&
          isValidWhatsAppNumber(owner.profile.whatsappNumber)
        )}
        paymentsReady={payments.status.ready}
        paymentsProblem={payments.problem}
        directFileUpload={blobStorageEnabled()}
      />
    </div>
  );
}
