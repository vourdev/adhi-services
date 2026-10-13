import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PriceTag } from "@/components/profile/blocks";
import { Icon } from "@/components/profile/icon";
import { MediaImage } from "@/components/profile/media-image";
import { ProfileSurface } from "@/components/profile/profile-view";
import { ViewBeacon } from "@/components/profile/view-beacon";
import { getDb } from "@/db/client";
import { lookFromProfile } from "@/lib/profile-look";
import { hasUsableCodes } from "@/server/discount-codes";
import { loadProduct } from "@/server/public-data";

import { CheckoutForm } from "./checkout-form";

type Props = { params: Promise<{ username: string; slug: string }> };

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  params,
}: Props): Promise<ReactNode> {
  const { username, slug } = await params;
  const loaded = await loadProduct(username, slug);
  if (
    !loaded ||
    loaded.product.status !== "published" ||
    loaded.product.checkoutMethod !== "direct"
  )
    notFound();
  const { product, profile, isOwner, paymentsReady } = loaded;
  const productPath = `/${profile.username}/${product.slug}`;
  const discountEnabled =
    paymentsReady && (await hasUsableCodes(getDb(), profile.id, product.id));

  return (
    <ProfileSurface look={lookFromProfile(profile)}>
      <div className="mx-auto flex w-full max-w-[34rem] flex-col px-4 pt-4 pb-12">
        <Link
          href={productPath}
          className="flex w-fit items-center gap-2 rounded-full py-2 pr-3 text-sm font-medium text-p-muted hover:text-p-fg"
        >
          <Icon icon={ArrowLeft01Icon} className="size-[18px]" />
          Kembali
        </Link>

        <main id="konten" className="mt-2 flex flex-col gap-6">
          <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>

          <section
            aria-label="Ringkasan pesanan"
            className="p-card flex items-center gap-3 p-3"
          >
            {product.coverUrl ? (
              <MediaImage
                src={product.coverUrl}
                alt=""
                width={128}
                height={128}
                className="size-16 shrink-0 rounded-[var(--p-r-media)] object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[15px] leading-snug font-semibold">
                {product.name}
              </p>
              <div className="mt-1">
                <PriceTag amount={product.priceAmount} />
              </div>
            </div>
          </section>

          {paymentsReady ? (
            <CheckoutForm
              productId={product.id}
              idempotencyKey={crypto.randomUUID()}
              price={product.priceAmount}
              discountEnabled={discountEnabled}
            />
          ) : (
            <p className="p-card px-4 py-6 text-center text-sm text-p-muted">
              Pembayaran online belum tersedia. Silakan hubungi penjual.
            </p>
          )}
        </main>
      </div>
      {paymentsReady && !isOwner ? (
        <ViewBeacon
          type="checkout_started"
          profileId={profile.id}
          productId={product.id}
        />
      ) : null}
    </ProfileSurface>
  );
}
