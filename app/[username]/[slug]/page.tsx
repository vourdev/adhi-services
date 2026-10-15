import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Chatting01Icon,
  CreditCardIcon,
  Download04Icon,
  Mail01Icon,
  StarIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PriceTag } from "@/components/profile/blocks";
import { BottomBar, ctaClass } from "@/components/profile/bottom-bar";
import { Icon, type IconSvgElement } from "@/components/profile/icon";
import { MediaImage } from "@/components/profile/media-image";
import { ProductDescription } from "@/components/profile/product-description";
import { ProfileFooter } from "@/components/profile/profile-footer";
import { ProfileSurface } from "@/components/profile/profile-view";
import { SellerAvatar } from "@/components/profile/seller-avatar";
import { ShareButton } from "@/components/profile/share-button";
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

type InfoRow = { icon: IconSvgElement; title: string; text: string };

/** What the buyer can expect, from the product's own settings only. */
function infoRows(
  checkoutMethod: "whatsapp" | "direct",
  hasDelivery: boolean
): InfoRow[] {
  if (checkoutMethod === "whatsapp")
    return [
      {
        icon: WhatsappIcon,
        title: "Pesan lewat WhatsApp",
        text: "Chat dengan penjual terbuka berisi pesan yang sudah disiapkan.",
      },
      {
        icon: Chatting01Icon,
        title: "Detail dibahas di chat",
        text: "Pembayaran dan pengiriman disepakati langsung dengan penjual.",
      },
    ];
  return [
    {
      icon: CreditCardIcon,
      title: "QRIS, virtual account, e-wallet, atau kartu",
      text: "Dibayar di halaman pembayaran yang aman.",
    },
    hasDelivery
      ? {
          icon: Download04Icon,
          title: "Akses langsung setelah bayar",
          text: "Link atau file produk muncul di halaman pesanan begitu pembayaran terverifikasi.",
        }
      : {
          icon: Chatting01Icon,
          title: "Penjual menghubungi Anda",
          text: "Langkah berikutnya dibahas setelah pembayaran diterima.",
        },
    {
      icon: Mail01Icon,
      title: "Bukti pembayaran lewat email",
      text: "Status pesanan juga bisa dicek kapan saja di halaman pesanan.",
    },
  ];
}

export default async function ProductPage({
  params,
}: Props): Promise<ReactNode> {
  const { username, slug } = await params;
  const loaded = await loadProduct(username, slug);
  if (!loaded) notFound();
  const { product, profile, isOwner, whatsappReady, paymentsReady } = loaded;
  const platform = await getPlatformSettings(getDb());
  const sellerPath = `/${profile.username}`;
  const whatsappOrder =
    product.checkoutMethod === "whatsapp" &&
    whatsappReady &&
    product.status === "published";
  const orderable =
    product.checkoutMethod === "whatsapp" ? whatsappOrder : paymentsReady;

  // WhatsApp ordering renders its own buttons (they carry the discount code).
  const closed = (
    <p className="p-card rounded-[var(--p-r-btn)] px-4 py-3.5 text-center text-sm text-p-muted">
      {product.checkoutMethod === "whatsapp"
        ? "Pemesanan belum dibuka."
        : "Pembayaran online belum tersedia."}
    </p>
  );
  const buyButton =
    product.checkoutMethod === "direct" && paymentsReady ? (
      <Link
        href={`/${profile.username}/${product.slug}/checkout`}
        prefetch={false}
        className={ctaClass}
      >
        {product.ctaLabel ?? "Beli Sekarang"}
        <Icon icon={ArrowRight01Icon} className="size-5" strokeWidth={2} />
      </Link>
    ) : null;

  return (
    <ProfileSurface look={lookFromProfile(profile)}>
      {product.status !== "published" ? (
        <div className="bg-p-fg px-4 py-2 text-center text-xs text-p-bg">
          Pratinjau draf. Hanya Anda yang bisa melihat halaman ini.
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[34rem] px-4 pt-3 pb-32 lg:max-w-5xl lg:px-8 lg:pt-8 lg:pb-12">
        <nav className="flex items-center justify-between gap-3">
          <Link
            href={sellerPath}
            className="flex min-w-0 items-center gap-2.5 rounded-full py-1.5 pr-3 text-[14px] font-semibold hover:text-p-accent-ink"
          >
            <Icon
              icon={ArrowLeft01Icon}
              className="size-[18px] shrink-0 text-p-muted"
            />
            <SellerAvatar name={profile.displayName} src={profile.avatarUrl} />
            <span className="truncate">{profile.displayName}</span>
          </Link>
          <ShareButton title={product.name} />
        </nav>

        <main
          id="konten"
          className="mt-3 lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-12"
        >
          <div className="p-card overflow-hidden lg:sticky lg:top-8">
            {product.coverUrl ? (
              <MediaImage
                src={product.coverUrl}
                alt={product.name}
                width={960}
                height={960}
                priority
                className="aspect-square w-full bg-p-line object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="grid aspect-square w-full place-items-center bg-p-accent-soft text-7xl font-bold text-p-accent-ink"
              >
                {product.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-6 lg:mt-0">
            <header className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[var(--p-r-btn)] bg-p-fg/[0.06] px-2.5 py-1 text-[12.5px] font-semibold text-p-fg/75">
                  {PRODUCT_TYPE_LABELS[product.productType]}
                </span>
                {product.isFeatured ? (
                  <span className="flex items-center gap-1 rounded-[var(--p-r-btn)] bg-p-accent-soft px-2.5 py-1 text-[12.5px] font-semibold text-p-accent-ink">
                    <Icon
                      icon={StarIcon}
                      className="size-3.5"
                      strokeWidth={2}
                    />
                    Unggulan
                  </span>
                ) : null}
              </div>
              <h1 className="text-[1.75rem] leading-[1.15] font-bold tracking-tight text-balance lg:text-[2.25rem]">
                {product.name}
              </h1>
              <PriceTag amount={product.priceAmount} size="lg" />
            </header>

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
            ) : (
              <div className="hidden lg:block">{buyButton ?? closed}</div>
            )}

            {orderable ? (
              <ul className="p-card flex flex-col divide-y divide-p-line">
                {infoRows(product.checkoutMethod, product.hasDelivery).map(
                  (row) => (
                    <li key={row.title} className="flex gap-3.5 p-4">
                      <span
                        aria-hidden
                        className="grid size-10 shrink-0 place-items-center rounded-[var(--p-r-media)] bg-p-accent-soft text-p-accent-ink"
                      >
                        <Icon icon={row.icon} className="size-5" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[14.5px] leading-snug font-semibold">
                          {row.title}
                        </span>
                        <span className="text-[13.5px] leading-snug text-p-muted">
                          {row.text}
                        </span>
                      </span>
                    </li>
                  )
                )}
              </ul>
            ) : null}

            {product.description ? (
              <section aria-labelledby="tentang-produk">
                <h2
                  id="tentang-produk"
                  className="mb-3 text-[13px] font-semibold tracking-[0.06em] text-p-muted uppercase"
                >
                  Tentang produk
                </h2>
                <ProductDescription text={product.description} />
              </section>
            ) : null}

          </div>
        </main>

        <ProfileFooter
          name={profile.displayName}
          brandName={platform.brandName}
          hideWatermark={profile.hideWatermark}
        />
      </div>

      {whatsappOrder ? null : buyButton ? (
        <BottomBar price={<PriceTag amount={product.priceAmount} />}>
          {buyButton}
        </BottomBar>
      ) : (
        <BottomBar>{closed}</BottomBar>
      )}

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
