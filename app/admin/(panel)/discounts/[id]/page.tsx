import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { adminContext } from "@/server/admin";
import { listDiscountCodes, listProductOptions } from "@/server/discount-codes";

import { KpiStrip } from "../../../_components/analytics/kpi-strip";
import { PageHeader } from "../../../_components/page-header";
import { DiscountForm } from "../_components/discount-form";
import { toFormValues } from "../_components/form-values";

export const metadata: Metadata = { title: "Edit kode diskon" };

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db, profileId } = await adminContext();
  const [codes, products] = await Promise.all([
    listDiscountCodes(db, profileId),
    listProductOptions(db, profileId),
  ]);
  const code = codes.find((row) => row.id === id);
  if (!code) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/discounts">
          <ArrowLeft />
          Semua kode
        </Link>
      </Button>
      <PageHeader
        title={code.code}
        description="Perubahan hanya berlaku untuk pesanan baru. Pesanan yang sudah dibuat tetap memakai potongan lamanya."
      />
      <KpiStrip
        items={[
          { label: "Pesanan lunas", value: code.paidUses, change: null },
          {
            label: "Total potongan",
            value: code.discountTotal,
            change: null,
            formatted: formatRupiah(code.discountTotal),
          },
        ]}
      />
      <DiscountForm
        codeId={code.id}
        initialValues={toFormValues(code)}
        products={products}
      />
    </div>
  );
}
