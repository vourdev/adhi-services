import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { adminContext } from "@/server/admin";
import { listProductOptions } from "@/server/discount-codes";

import { PageHeader } from "../../../_components/page-header";
import { DiscountForm } from "../_components/discount-form";
import { NEW_DISCOUNT_CODE } from "../_components/form-values";

export const metadata: Metadata = { title: "Kode diskon baru" };

export default async function NewDiscountPage(): Promise<ReactNode> {
  const { db, profileId } = await adminContext();
  const products = await listProductOptions(db, profileId);
  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/discounts">
          <ArrowLeft />
          Semua kode
        </Link>
      </Button>
      <PageHeader
        title="Kode diskon baru"
        description="Kode langsung bisa dipakai setelah disimpan, kecuali Anda mengatur waktu mulai."
      />
      <DiscountForm
        codeId={null}
        initialValues={NEW_DISCOUNT_CODE}
        products={products}
      />
    </div>
  );
}
