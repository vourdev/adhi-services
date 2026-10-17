import {
  ArrowLeft01Icon,
  Chatting01Icon,
  CreditCardIcon,
  Download04Icon,
  Mail01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CartLink } from "@/components/cart/cart-link";
import { PRODUCT_TYPE_ICONS, PriceTag } from "@/components/profile/blocks";
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
import { describeLimits } from "@/lib/quantity";
import { cartProducts, readCart } from "@/server/cart";
import { hasUsableCodes } from "@/server/discount-codes";
import { getPlatformSettings } from "@/server/platform-settings";
import { loadProduct } from "@/server/public-data";

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

type Fact = { icon: IconSvgElement; text: string };

/** What the buyer can expect, from the product's own settings only. */
function facts(
  checkoutMethod: "whatsapp" | "direct",
  hasDelivery: boolean
): Fact[] {
  if (checkoutMethod === "whatsapp")
    return [
      {
        icon: WhatsappIcon,
        text: "Dipesan lewat WhatsApp; chat terbuka dengan pesan yang sudah disiapkan.",
      },
      {
        icon: Chatting01Icon,
        text: "Pembayaran dan pengiriman disepakati langsung dengan penjual.",
      },
    ];
  return [
    {
      icon: CreditCardIcon,
      text: "Bayar dengan QRIS, virtual account, e-wallet, atau kartu.",
    },
    hasDelivery
      ? {
          icon: Download04Icon,
          text: "Link produk muncul di halaman pesanan begitu pembayaran terverifikasi.",
        }
      : {
          icon: Chatting01Icon,
          text: "Penjual menghubungi Anda setelah pembayaran diterima.",
        },
    { icon: Mail01Icon, text: "Bukti pembayaran dikirim ke email Anda." },
  ];
}

/** Round icon buttons laid over the product image on phones. */
const overlayButton =
  "grid size-10 place-items-center rounded-full bg-p-card/85 text-p-fg backdrop-blur-md";

export default async function ProductPage({
  params,
}: Props): Promise<ReactNode> {
  const { username, slug } = await params;
  const loaded = await loadProduct(username, slug);
  if (!loaded) notFound();
  const { product, profile, isOwner, whatsappReady, paymentsReady } = loaded;
  const [platform, cart] = await Promise.all([
    getPlatformSettings(getDb()),
    readCart().then((lines) => cartProducts(profile.id, lines)),
  ]);
  const sellerPath = `/${profile.username}`;
  const published = product.status === "published";
  const whatsappOrder =
    product.checkoutMethod === "whatsapp" && whatsappReady && published;
  const directOrder =
    product.checkoutMethod === "direct" && paymentsReady && published;
  const inCart = cart.some((line) => line.product.id === product.id);

  const closed = (
    <p className="rounded-[var(--p-r-btn)] border border-p-line px-4 py-3.5 text-center text-sm text-p-muted">
      {!published
        ? "Produk ini masih draf."
        : product.checkoutMethod === "whatsapp"
          ? "Pemesanan belum dibuka."
          : "Pembayaran online belum tersedia."}
    </p>
  );
  const buyButtons = directOrder ? (
    <div className="flex gap-3">
      <AddToCartButton
        productId={product.id}
        cartHref={`${sellerPath}/checkout`}
        inCart={inCart}
        className="h-13 w-14 rounded-[var(--p-r-btn)] border border-p-fg/80 text-p-fg"
      />
      <Link
        href={`${sellerPath}/checkout?beli=${product.id}`}
        prefetch={false}
        className={ctaClass}
      >
        {product.ctaLabel ?? "Beli sekarang"}
      </Link>
    </div>
  ) : null;

  return (
    <ProfileSurface look={lookFromProfile(profile)}>
      {!published ? (
        <div className="bg-p-fg px-4 py-2 text-center text-xs text-p-bg">
          Pratinjau draf. Hanya Anda yang bisa melihat halaman ini.
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[34rem] pb-32 lg:max-w-5xl lg:px-8 lg:pt-8 lg:pb-12">
        <nav className="hidden items-center justify-between gap-3 lg:flex">
          <Link
            href={sellerPath}
            className="flex min-w-0 items-center gap-2.5 py-1.5 pr-3 text-[14px] font-semibold"
          >
            <Icon
              icon={ArrowLeft01Icon}
              className="size-[18px] shrink-0 text-p-muted"
            />
            <SellerAvatar name={profile.displayName} src={profile.avatarUrl} />
            <span className="truncate">{profile.displayName}</span>
          </Link>
          <div className="flex items-center gap-1">
            <ShareButton title={product.name} />
            <CartLink username={profile.username} count={cart.length} />
          </div>
        </nav>

        <main
          id="konten"
          className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-12"
        >
          <div className="relative lg:sticky lg:top-8">
            {product.coverUrl ? (
              <MediaImage
                src={product.coverUrl}
                alt={product.name}
                width={960}
                height={960}
                priority
                className="aspect-square w-full bg-p-quiet object-cover lg:rounded-[var(--p-r-card)]"
              />
            ) : (
              <span
                aria-hidden
                className="grid aspect-square w-full place-items-center bg-p-quiet text-p-muted lg:rounded-[var(--p-r-card)]"
              >
                <Icon
                  icon={PRODUCT_TYPE_ICONS[product.productType]}
                  className="size-16"
                  strokeWidth={1.25}
                />
              </span>
            )}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 lg:hidden">
              <Link
                href={sellerPath}
                aria-label={`Kembali ke ${profile.displayName}`}
                className={overlayButton}
              >
                <Icon icon={ArrowLeft01Icon} className="size-5" />
              </Link>
              <div className="flex items-center gap-2">
                <ShareButton
                  title={product.name}
                  compact
                  className={overlayButton}
                />
                <CartLink
                  username={profile.username}
                  count={cart.length}
                  className={overlayButton}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-6 px-4 lg:mt-0 lg:px-0">
            <header className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-p-muted">
                {PRODUCT_TYPE_LABELS[product.productType]} oleh{" "}
                <Link
                  href={sellerPath}
                  className="text-p-fg underline-offset-4 hover:underline"
                >
                  {profile.displayName}
                </Link>
              </span>
              <h1 className="text-[1.625rem] leading-[1.2] font-bold tracking-tight text-balance lg:text-[2.125rem]">
                {product.name}
              </h1>
              <PriceTag
                amount={product.priceAmount}
                compareAt={product.compareAtAmount}
                size="lg"
              />
              {product.checkoutMethod === "direct" &&
              describeLimits(product.limits) ? (
                <span className="text-[13px] text-p-muted">
                  {describeLimits(product.limits)}
                </span>
              ) : null}
            </header>

            {whatsappOrder ? (
              <WhatsAppOrder
                productId={product.id}
                price={product.priceAmount}
                label={product.ctaLabel ?? "Pesan via WhatsApp"}
                discountEnabled={await hasUsableCodes(getDb(), profile.id, [
                  product.id,
                ])}
              />
            ) : (
              <div className="hidden lg:block">{buyButtons ?? closed}</div>
            )}

            {whatsappOrder || directOrder ? (
              <ul className="flex flex-col gap-2.5 border-y border-p-line py-4">
                {facts(product.checkoutMethod, product.hasDelivery).map(
                  (fact) => (
                    <li
                      key={fact.text}
                      className="flex gap-3 text-[14px] leading-snug text-p-fg/80"
                    >
                      <Icon
                        icon={fact.icon}
                        className="mt-px size-[18px] shrink-0 text-p-muted"
                      />
                      {fact.text}
                    </li>
                  )
                )}
              </ul>
            ) : null}

            {product.description ? (
              <section aria-labelledby="deskripsi">
                <h2
                  id="deskripsi"
                  className="mb-2 text-[15px] font-semibold tracking-tight"
                >
                  Deskripsi
                </h2>
                <ProductDescription text={product.description} />
              </section>
            ) : null}
          </div>
        </main>

        <div className="px-4 lg:px-0">
          <ProfileFooter
            name={profile.displayName}
            brandName={platform.brandName}
            hideWatermark={profile.hideWatermark}
          />
        </div>
      </div>

      {whatsappOrder ? null : <BottomBar>{buyButtons ?? closed}</BottomBar>}

      {published && !isOwner ? (
        <ViewBeacon
          type="product_view"
          profileId={profile.id}
          productId={product.id}
        />
      ) : null}
    </ProfileSurface>
  );
}
