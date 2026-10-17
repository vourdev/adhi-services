import {
  ArrowLeft01Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/profile/icon";
import { ProfileSurface } from "@/components/profile/profile-view";
import { ViewBeacon } from "@/components/profile/view-beacon";
import { getDb } from "@/db/client";
import { lookFromProfile } from "@/lib/profile-look";
import { cartProducts, parseCart, readCart } from "@/server/cart";
import { hasUsableCodes } from "@/server/discount-codes";
import { paymentsStatus } from "@/server/payments";
import { loadProfile } from "@/server/public-data";

import { CheckoutForm } from "./checkout-form";

type Props = {
  params: Promise<{ username: string }>;
  /** ?beli=<product id>: "Beli sekarang" for that product alone; otherwise the cart. */
  searchParams: Promise<{ beli?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  params,
  searchParams,
}: Props): Promise<ReactNode> {
  const { username } = await params;
  const { beli } = await searchParams;
  const loaded = await loadProfile(username);
  if (!loaded) notFound();
  const { profile, isOwner } = loaded;
  const buyNow = typeof beli === "string" ? parseCart(beli).slice(0, 1) : [];
  const fromCart = buyNow.length === 0;
  const lines = await cartProducts(
    profile.id,
    fromCart ? await readCart() : buyNow
  );
  // A "Beli sekarang" link for a product that is gone or not sold online.
  if (!fromCart && lines.length === 0) notFound();
  const paymentsReady = paymentsStatus().ready;
  const ids = lines.map((line) => line.product.id);
  const discountEnabled =
    paymentsReady && (await hasUsableCodes(getDb(), profile.id, ids));
  const backHref =
    !fromCart && lines[0]
      ? `/${profile.username}/${lines[0].product.slug}`
      : `/${profile.username}`;

  return (
    <ProfileSurface look={lookFromProfile(profile)}>
      <header className="border-b border-p-line bg-p-card">
        <div className="mx-auto grid h-14 w-full max-w-5xl grid-cols-[2.5rem_1fr_2.5rem] items-center px-4 lg:px-8">
          <Link
            href={backHref}
            aria-label="Kembali"
            className="-ml-2 grid size-10 place-items-center rounded-full text-p-fg"
          >
            <Icon icon={ArrowLeft01Icon} className="size-5" />
          </Link>
          <h1 className="text-center text-[17px] font-semibold tracking-tight">
            {fromCart ? "Keranjang" : "Checkout"}
          </h1>
        </div>
      </header>

      <main
        id="konten"
        className="mx-auto w-full max-w-5xl px-4 py-5 lg:px-8 lg:py-8"
      >
        {lines.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-p-quiet text-p-muted">
              <Icon icon={ShoppingCart01Icon} className="size-6" />
            </span>
            <h2 className="text-lg font-semibold">Keranjang masih kosong</h2>
            <p className="text-sm text-p-muted">
              Tambahkan produk dari halaman produk dengan tombol keranjang.
            </p>
            <Link
              href={`/${profile.username}`}
              className="p-btn p-press mt-2 flex h-11 items-center px-5 text-[15px] font-semibold ring-1 ring-p-line"
            >
              Lihat produk {profile.displayName}
            </Link>
          </div>
        ) : paymentsReady ? (
          <CheckoutForm
            items={lines.map(({ product, limits, quantity }) => ({
              id: product.id,
              name: product.name,
              href: `/${profile.username}/${product.slug}`,
              coverUrl: product.coverUrl,
              productType: product.productType,
              price: product.priceAmount,
              compareAt: product.compareAtAmount,
              quantity,
              min: limits.min,
              max: limits.max,
            }))}
            fromCart={fromCart}
            idempotencyKey={crypto.randomUUID()}
            discountEnabled={discountEnabled}
            hasDelivery={lines.some(
              (line) => line.product.deliveryType !== "none"
            )}
          />
        ) : (
          <p className="p-card mx-auto max-w-md px-4 py-6 text-center text-sm text-p-muted">
            Pembayaran online belum tersedia. Silakan hubungi penjual.
          </p>
        )}
      </main>
      {paymentsReady && lines[0] && !isOwner ? (
        <ViewBeacon
          type="checkout_started"
          profileId={profile.id}
          productId={lines[0].product.id}
        />
      ) : null}
    </ProfileSurface>
  );
}
