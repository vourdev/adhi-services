import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Briefcase01Icon,
  Call02Icon,
  Facebook01Icon,
  GithubIcon,
  Globe02Icon,
  InstagramIcon,
  Linkedin01Icon,
  Mail01Icon,
  NewTwitterIcon,
  TelegramIcon,
  TiktokIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { PRODUCT_TYPE_LABELS } from "@/lib/domain";
import { formatRupiah } from "@/lib/format";
import type { LinkIconKey } from "@/lib/link-icon";
import type { PublicBlock, PublicProductCard } from "@/lib/public-types";

import { Icon, type IconSvgElement } from "./icon";
import { MediaImage } from "./media-image";

/**
 * Profile blocks. Links point at /go/... so the click is recorded on the
 * server before the redirect; nothing here needs JavaScript.
 *
 * Corners, edges and shadows come from the profile's look (.p-card, .p-row,
 * .p-btn and the --p-r-* radii in app/globals.css), so the card shape and
 * card style settings apply to every block.
 */

const LINK_ICONS: Record<LinkIconKey, IconSvgElement> = {
  whatsapp: WhatsappIcon,
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  youtube: YoutubeIcon,
  linkedin: Linkedin01Icon,
  github: GithubIcon,
  x: NewTwitterIcon,
  facebook: Facebook01Icon,
  telegram: TelegramIcon,
  email: Mail01Icon,
  phone: Call02Icon,
  internal: Briefcase01Icon,
  web: Globe02Icon,
};

/** A tall card (image on top). */
const card = "p-card p-press";
/** A one-line card: icon or thumbnail, text, arrow. */
const row = "p-card p-row p-press";

type LinkData = Extract<PublicBlock, { type: "link" }>;

function TrailingArrow({ internal }: { internal: boolean }): ReactNode {
  return (
    <Icon
      icon={internal ? ArrowRight01Icon : ArrowUpRight01Icon}
      className="size-5 shrink-0 text-p-muted"
    />
  );
}

export function HeadingBlock({ title }: { title: string }): ReactNode {
  return (
    <h2 className="flex items-center gap-3 px-1 pt-5 text-[12.5px] font-semibold tracking-[0.08em] text-p-muted uppercase first:pt-1">
      <span className="shrink-0">{title}</span>
      <span aria-hidden className="h-px flex-1 bg-p-line" />
    </h2>
  );
}

/** "Featured" links with an image: a large card, used for the main offer. */
function FeaturedLink({
  block,
  image,
}: {
  block: LinkData;
  image: string;
}): ReactNode {
  const internal = block.icon === "internal";
  return (
    <a
      href={block.href}
      rel="nofollow"
      className={`flex flex-col overflow-hidden ${card}`}
    >
      <MediaImage
        src={image}
        alt=""
        width={960}
        height={600}
        eager
        className="aspect-[16/10] w-full bg-p-line object-cover object-top"
      />
      <span className="flex items-center gap-3 p-4">
        <span className="min-w-0 flex-1">
          {block.category ? (
            <span className="mb-1 block text-[12.5px] font-semibold text-p-accent-ink">
              {block.category}
            </span>
          ) : null}
          <span className="block text-[17px] leading-snug font-bold tracking-tight text-balance">
            {block.title}
          </span>
          {block.description ? (
            <span className="mt-1 line-clamp-2 block text-[14px] leading-snug text-p-muted">
              {block.description}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden
          className="p-btn grid size-10 shrink-0 place-items-center bg-p-accent text-p-accent-fg"
        >
          <Icon
            icon={
              block.icon === "whatsapp"
                ? WhatsappIcon
                : internal
                  ? ArrowRight01Icon
                  : ArrowUpRight01Icon
            }
            className="size-5"
            strokeWidth={2}
          />
        </span>
      </span>
    </a>
  );
}

export function LinkBlock({ block }: { block: LinkData }): ReactNode {
  if (block.layout === "featured" && block.thumbnailUrl)
    return <FeaturedLink block={block} image={block.thumbnailUrl} />;

  return (
    <a
      href={block.href}
      rel="nofollow"
      className={`flex items-center gap-3.5 p-3 pr-4 ${row}`}
    >
      {block.thumbnailUrl ? (
        <MediaImage
          src={block.thumbnailUrl}
          alt=""
          width={112}
          height={112}
          className="size-12 shrink-0 rounded-[var(--p-r-media)] bg-p-line object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-[var(--p-r-media)] bg-p-accent-soft text-p-accent-ink"
        >
          <Icon icon={LINK_ICONS[block.icon]} className="size-[22px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[15px] leading-snug font-semibold">
          {block.title}
        </span>
        {block.description ? (
          <span className="mt-0.5 line-clamp-2 block text-[13.5px] leading-snug text-p-muted">
            {block.description}
          </span>
        ) : null}
      </span>
      <TrailingArrow internal={block.icon === "internal"} />
    </a>
  );
}

/** Price in whole rupiah; Rp0 reads "Gratis". */
export function PriceTag({
  amount,
  size = "md",
}: {
  amount: number;
  size?: "md" | "lg";
}): ReactNode {
  return (
    <span
      className={`${size === "lg" ? "text-[1.75rem] leading-none" : "text-[15px]"} font-bold text-p-price tabular-nums`}
    >
      {amount === 0 ? "Gratis" : formatRupiah(amount)}
    </span>
  );
}

function ProductCover({
  product,
  className,
}: {
  product: PublicProductCard;
  className: string;
}): ReactNode {
  return product.coverUrl ? (
    <MediaImage
      src={product.coverUrl}
      alt=""
      width={320}
      height={320}
      className={`bg-p-line object-cover ${className}`}
    />
  ) : (
    <span
      aria-hidden
      className={`grid place-items-center bg-p-accent-soft text-3xl font-bold text-p-accent-ink ${className}`}
    >
      {product.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** A product on its own row. Also the card preview in the dashboard. */
export function ProductBlock({
  product,
  href,
}: {
  product: PublicProductCard;
  href: string;
}): ReactNode {
  return (
    <a href={href} className={`flex items-center gap-3.5 p-3 pr-4 ${row}`}>
      <ProductCover
        product={product}
        className="size-20 shrink-0 rounded-[var(--p-r-media)]"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[12.5px] font-medium text-p-muted">
          {PRODUCT_TYPE_LABELS[product.productType]}
        </span>
        <span className="line-clamp-2 text-[15px] leading-snug font-semibold">
          {product.name}
        </span>
        <PriceTag amount={product.priceAmount} />
      </span>
      <TrailingArrow internal />
    </a>
  );
}

/** Two or more products in a row become a two-column grid of these. */
export function ProductTile({
  product,
  href,
}: {
  product: PublicProductCard;
  href: string;
}): ReactNode {
  return (
    <a href={href} className={`flex flex-col overflow-hidden ${card}`}>
      <ProductCover product={product} className="aspect-square w-full" />
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-[12px] font-medium text-p-muted">
          {PRODUCT_TYPE_LABELS[product.productType]}
        </span>
        <span className="line-clamp-2 text-[14.5px] leading-snug font-semibold">
          {product.name}
        </span>
        <span className="mt-auto pt-1">
          <PriceTag amount={product.priceAmount} />
        </span>
      </span>
    </a>
  );
}
