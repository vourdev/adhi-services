import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { blobStorageEnabled, siteUrl } from "@/lib/env";
import { visitorLook } from "@/lib/profile-look";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";
import { adminContext, ownerPayments } from "@/server/admin";

import { PageHeader } from "../../../_components/page-header";
import { NEW_PRODUCT } from "../_components/form-values";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = { title: "Produk baru" };

export default async function NewProductPage(): Promise<ReactNode> {
  const { owner } = await adminContext();
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
        title="Produk baru"
        description="Simpan sebagai draf dulu, lalu publikasikan setelah semuanya siap."
      />
      <ProductForm
        productId={null}
        initialValues={NEW_PRODUCT}
        username={owner.profile.username}
        siteUrl={siteUrl()}
        profileLook={visitorLook(owner.profile, owner.user.plan === "premium")}
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
