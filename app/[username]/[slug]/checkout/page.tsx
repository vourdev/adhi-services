import { ArrowLeft01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/profile/icon";
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
      <div className="mx-auto w-full max-w-[34rem] px-4 pt-3 pb-12 lg:max-w-5xl lg:px-8 lg:pt-8">
        <nav className="flex items-center justify-between gap-3">
          <Link
            href={productPath}
            className="flex items-center gap-2 rounded-full py-2 pr-3 text-[14px] font-semibold text-p-muted hover:text-p-fg"
          >
            <Icon icon={ArrowLeft01Icon} className="size-[18px]" />
            Kembali
          </Link>
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-p-muted">
            <Icon icon={SquareLock02Icon} className="size-4" />
            Pembayaran aman
          </span>
        </nav>

        <main id="konten" className="mt-4 lg:mt-6">
          <header className="flex flex-col gap-3">
            <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">
              Checkout
            </h1>
            <ol
              aria-label="Langkah"
              className="flex items-center gap-2.5 text-[13px] font-medium"
            >
              <li aria-current="step" className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-p-accent text-xs font-bold text-p-accent-fg">
                  1
                </span>
                Data pembeli
              </li>
              <li aria-hidden className="h-px w-6 bg-p-line" />
              <li className="flex items-center gap-2 text-p-muted">
                <span className="grid size-6 place-items-center rounded-full text-xs font-bold ring-1 ring-p-line ring-inset">
                  2
                </span>
                Pembayaran
              </li>
            </ol>
          </header>

          {paymentsReady ? (
            <CheckoutForm
              product={{
                id: product.id,
                name: product.name,
                coverUrl: product.coverUrl,
                hasDelivery: product.hasDelivery,
              }}
              seller={profile.displayName}
              idempotencyKey={crypto.randomUUID()}
              price={product.priceAmount}
              discountEnabled={discountEnabled}
            />
          ) : (
            <p className="p-card mt-6 px-4 py-6 text-center text-sm text-p-muted">
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
