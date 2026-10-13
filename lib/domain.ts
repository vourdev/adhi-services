/**
 * Shared enums for the database schema, validation and UI. Keep this file
 * free of runtime imports so it can be used on the server, in the browser
 * and in tests.
 */

export const USER_ROLES = ["super_admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_PLANS = ["free", "premium"] as const;
export type UserPlan = (typeof USER_PLANS)[number];

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const THEME_PRESETS = [
  "default",
  "minimal",
  "glassmorphism",
  "neon",
  "brutalist",
  "custom",
] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const CARD_SHAPES = [
  "sharp",
  "rounded",
  "smooth",
  "extra",
  "pill",
] as const;
export type CardShape = (typeof CARD_SHAPES)[number];

export const CARD_STYLES = [
  "solid",
  "glass",
  "outline",
  "shadow",
  "neobrutalism",
  "glow",
] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export const FONTS = [
  "Plus Jakarta Sans",
  "Inter",
  "Poppins",
  "Outfit",
  "Space Grotesk",
  "Playfair Display",
] as const;
export type FontOption = (typeof FONTS)[number];

export const MIDTRANS_MODES = ["platform", "custom"] as const;
export type MidtransMode = (typeof MIDTRANS_MODES)[number];

export const PROFILE_THEMES = ["system", "light", "dark"] as const;
export type ProfileTheme = (typeof PROFILE_THEMES)[number];

export const ACCENTS = [
  "blue",
  "emerald",
  "rose",
  "amber",
  "violet",
  "slate",
] as const;
export type Accent = (typeof ACCENTS)[number];

/** A colour the owner picked: "#rrggbb", lowercase. */
export type AccentHex = `#${string}`;

/** What a profile stores as its accent: one of the named accents or a picked colour. */
export type AccentValue = Accent | AccentHex;

export const SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "github",
  "x",
  "facebook",
  "threads",
  "whatsapp",
  "telegram",
  "email",
  "website",
  "portfolio",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** "whatsapp" opens a chat with the profile's WhatsApp number (from Settings) and a prefilled message. */
export const LINK_KINDS = ["link", "heading", "product", "whatsapp"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_LAYOUTS = ["classic", "featured"] as const;
export type LinkLayout = (typeof LINK_LAYOUTS)[number];

export const PRODUCT_TYPES = [
  "digital",
  "template",
  "service",
  "other",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ["draft", "published"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CHECKOUT_METHODS = ["whatsapp", "direct"] as const;
export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number];

export const DELIVERY_TYPES = ["none", "file", "link"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export const DISCOUNT_CODE_TYPES = ["percent", "fixed"] as const;
export type DiscountCodeType = (typeof DISCOUNT_CODE_TYPES)[number];

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "failed",
  "expired",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const EVENT_TYPES = [
  "profile_view",
  "link_click",
  "product_view",
  "product_click",
  "whatsapp_checkout_clicked",
  "checkout_started",
  "payment_initiated",
  "payment_succeeded",
  "payment_failed",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Events a browser may report through POST /api/events. Everything else is recorded by the server. */
export const CLIENT_EVENT_TYPES = [
  "profile_view",
  "product_view",
  "checkout_started",
] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

export const TRAFFIC_SOURCES = [
  "direct",
  "search",
  "social",
  "referral",
  "other",
] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

export const DEVICES = ["mobile", "tablet", "desktop", "unknown"] as const;
export type Device = (typeof DEVICES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  digital: "Produk digital",
  template: "Template",
  service: "Jasa",
  other: "Lainnya",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Menunggu pembayaran",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan",
};

export const TRAFFIC_SOURCE_LABELS: Record<TrafficSource, string> = {
  direct: "Langsung / tidak diketahui",
  search: "Mesin pencari",
  social: "Media sosial & chat",
  referral: "Situs lain",
  other: "Lainnya",
};

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  github: "GitHub",
  x: "X",
  facebook: "Facebook",
  threads: "Threads",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
  website: "Website",
  portfolio: "Portfolio",
};
