import type { QuantityLimits } from "./quantity";
import type {
  AccentValue,
  CheckoutMethod,
  LinkLayout,
  ProductType,
  ProfileTheme,
  SocialPlatform,
} from "@/lib/domain";
import type { LinkIconKey } from "@/lib/link-icon";

/**
 * Data that may be sent to anonymous visitors. Built by server/profile.ts;
 * never contains owner email, WhatsApp numbers, delivery files or analytics.
 */

export type PublicSocial = {
  id: string;
  platform: SocialPlatform;
  url: string;
};

export type PublicProductCard = {
  id: string;
  slug: string;
  name: string;
  /** Price in whole rupiah. Discount codes are applied at checkout, not here. */
  priceAmount: number;
  /** The earlier price shown struck through; null when not on sale. */
  compareAtAmount: number | null;
  coverUrl: string | null;
  isFeatured: boolean;
  productType: ProductType;
  checkoutMethod: CheckoutMethod;
};

export type PublicBlock =
  | {
      type: "link";
      id: string;
      title: string;
      description: string | null;
      thumbnailUrl: string | null;
      category: string | null;
      layout: LinkLayout;
      /** Icon derived from the destination; the destination itself stays behind /go. */
      icon: LinkIconKey;
      href: string;
    }
  | { type: "heading"; id: string; title: string }
  | { type: "product"; id: string; product: PublicProductCard; href: string };

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  theme: ProfileTheme;
  accent: AccentValue;
  themePreset?: string | null | undefined;
  customTheme?: string | null | undefined;
  fontFamily?: string | null | undefined;
  cardShape?: string | null | undefined;
  cardStyle?: string | null | undefined;
  hideWatermark?: boolean | null | undefined;
  customFaviconUrl?: string | null | undefined;
  ogImageUrl?: string | null | undefined;
  trackingPixels?: string | null | undefined;
  socials: PublicSocial[];
  blocks: PublicBlock[];
};

export type PublicProduct = PublicProductCard & {
  description: string;
  ctaLabel: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: "draft" | "published";
  hasDelivery: boolean;
  /** Units one order may buy (lib/quantity.ts). */
  limits: QuantityLimits;
};
