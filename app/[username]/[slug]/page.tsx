import {
  ArrowLeft01Icon,
  Clock01Icon,
  SecurityCheckIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PriceTag } from "@/components/profile/blocks";
import { BottomBar, ctaClass } from "@/components/profile/bottom-bar";
import { Icon } from "@/components/profile/icon";
import { MediaImage } from "@/components/profile/media-image";
import { ProfileFooter } from "@/components/profile/profile-footer";
import { ProfileSurface } from "@/components/profile/profile-view";
import { ViewBeacon } from "@/components/profile/view-beacon";
import { WhatsAppOrder } from "@/components/profile/whatsapp-order";
import { getDb } from "@/db/client";
import { PRODUCT_TYPE_LABELS } from "@/lib/domain";
import { lookFromProfile } from "@/lib/profile-look";
import { hasUsableCodes } from "@/server/discount-codes";
import { loadProduct } from "@/server/public-data";
import { getPlatformSettings } from "@/server/super-admin";

type Props = { params: Promise<{ username: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const loaded = await loadProduct(username, slug);
  if (!loaded)
    return { title: "Produk tidak ditemukan", robots: { index: false } };
  const { product, profile } = loaded;
  const title = `${product.seoTitle ?? product.name} | ${profile.displayName}`;
  const description =
    product.seoDescription ??
    (product.description.replace(/\s+/g, " ").slice(0, 155) ||
      `${product.name} oleh ${profile.displayName}.`);
  const path = `/${profile.username}/${product.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "id_ID",
      url: path,
      title,
      description,
      ...(product.coverUrl ? { images: [{ url: product.coverUrl }] } : {}),
    },
    twitter: {
      card: product.coverUrl ? "summary_large_image" : "summary",
      title,
      description,
    },
    robots:
      product.status === "published"
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}

export default async function ProductPage({
  params,
}: Props): Promise<ReactNode> {
  const { username, slug } = await params;
  const loaded = await loadProduct(username, slug);
  if (!loaded) notFound();
  const { product, profile, isOwner, whatsappReady, paymentsReady } = loaded;
  const platform = await getPlatformSettings(getDb());
  const whatsappOrder =
    product.checkoutMethod === "whatsapp" &&
    whatsappReady &&
    product.status === "published";

  // WhatsApp ordering renders its own button (it carries the discount code).
  let cta: ReactNode = null;
  if (product.checkoutMethod === "whatsapp") {
    cta = whatsappOrder ? null : (
      <p className="p-card rounded-[var(--p-r-btn)] px-4 py-3.5 text-center text-sm text-p-muted">
        Pemesanan belum dibuka.
      </p>
    );
  } else {
    cta = paymentsReady ? (
      <Link
        href={`/${profile.username}/${product.slug}/checkout`}
        prefetch={false}
        className={ctaClass}
      >
        {product.ctaLabel ?? "Beli Sekarang"}
      </Link>
    ) : (
      <p className="p-card rounded-[var(--p-r-btn)] px-4 py-3.5 text-center text-sm text-p-muted">
        Pembayaran online belum tersedia.
      </p>
    );
  }

  return (
    <ProfileSurface look={lookFromProfile(profile)}>
      {product.status !== "published" ? (
        <div className="bg-p-fg px-4 py-2 text-center text-xs text-p-bg">
          Pratinjau draf. Hanya Anda yang bisa melihat halaman ini.
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-[34rem] flex-col px-4 pt-4 pb-32">
        <Link
          href={`/${profile.username}`}
          className="flex w-fit items-center gap-2 rounded-full py-2 pr-3 text-sm font-medium text-p-muted hover:text-p-fg"
        >
          <Icon icon={ArrowLeft01Icon} className="size-[18px]" />
          {profile.displayName}
        </Link>

        <main id="konten" className="mt-2">
          {product.coverUrl ? (
            <MediaImage
              src={product.coverUrl}
              alt={product.name}
              width={960}
              height={960}
              priority
              className="aspect-square w-full rounded-[var(--p-r-card)] bg-p-line object-cover"
            />
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-p-muted">
            <span>{PRODUCT_TYPE_LABELS[product.productType]}</span>
            {product.isFeatured ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-p-fg">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-p-accent"
                />
                Unggulan
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-2xl leading-tight font-bold tracking-tight text-balance">
            {product.name}
          </h1>
          <div className="mt-3">
            <PriceTag amount={product.priceAmount} size="lg" />
          </div>
          {whatsappOrder ? (
            <WhatsAppOrder
              productId={product.id}
              price={product.priceAmount}
              label={product.ctaLabel ?? "Pesan via WhatsApp"}
              discountEnabled={await hasUsableCodes(
                getDb(),
                profile.id,
                product.id
              )}
            />
          ) : null}

          {product.description ? (
            <div className="mt-6 text-[15px] leading-relaxed whitespace-pre-line text-p-fg/90">
              {product.description}
            </div>
          ) : null}

          {product.checkoutMethod === "direct" ? (
            <ul className="mt-8 flex flex-col divide-y divide-p-line border-y border-p-line text-sm text-p-muted [&>li]:py-3.5">
              <li className="flex gap-2.5">
                <Icon
                  icon={SquareLock02Icon}
                  className="mt-px size-[18px] shrink-0 text-p-accent-ink"
                />
                Pembayaran diproses oleh Midtrans (QRIS, virtual account,
                e-wallet, kartu).
              </li>
              {product.hasDelivery ? (
                <li className="flex gap-2.5">
                  <Icon
                    icon={SecurityCheckIcon}
                    className="mt-px size-[18px] shrink-0 text-p-accent-ink"
                  />
                  Link unduhan muncul di halaman pesanan setelah pembayaran
                  terverifikasi.
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-6 flex gap-2.5 text-sm text-p-muted">
              <Icon icon={Clock01Icon} className="mt-px size-[18px] shrink-0" />
              Pesanan dikonfirmasi lewat chat WhatsApp. Pembayaran dan
              pengiriman dibahas di sana.
            </p>
          )}
        </main>

        <ProfileFooter
          name={profile.displayName}
          brandName={platform.brandName}
          hideWatermark={profile.hideWatermark}
        />
      </div>

      {cta ? <BottomBar>{cta}</BottomBar> : null}

      {product.status === "published" && !isOwner ? (
        <ViewBeacon
          type="product_view"
          profileId={profile.id}
          productId={product.id}
        />
      ) : null}
    </ProfileSurface>
  );
}
