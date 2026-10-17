import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import {
  type AccentValue,
  CARD_SHAPES,
  CARD_STYLES,
  CHECKOUT_METHODS,
  DELIVERY_TYPES,
  DEVICES,
  DISCOUNT_CODE_TYPES,
  EVENT_TYPES,
  LINK_KINDS,
  LINK_LAYOUTS,
  MIDTRANS_MODES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  PROFILE_THEMES,
  SOCIAL_PLATFORMS,
  THEME_PRESETS,
  TRAFFIC_SOURCES,
} from "@/lib/domain";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ---------------------------------------------------------------- accounts

/** The site has one account: its owner. There is no sign-up. */
export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Opaque session tokens. Only the SHA-256 of the token is stored. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

/** Failed sign-in attempts, used for rate limiting. */
export const authAttempts = sqliteTable(
  "auth_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifier: text("identifier").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_attempts_identifier_idx").on(t.identifier, t.createdAt)]
);

// ----------------------------------------------------------------- profile

export const profiles = sqliteTable(
  "profiles",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    coverUrl: text("cover_url"),
    theme: text("theme", { enum: PROFILE_THEMES }).notNull().default("system"),
    /** A named accent (ACCENTS) or a picked colour as "#rrggbb". */
    accent: text("accent").$type<AccentValue>().notNull().default("blue"),
    themePreset: text("theme_preset", { enum: THEME_PRESETS })
      .notNull()
      .default("default"),
    customTheme: text("custom_theme"),
    fontFamily: text("font_family").notNull().default("Plus Jakarta Sans"),
    cardShape: text("card_shape", { enum: CARD_SHAPES })
      .notNull()
      .default("smooth"),
    cardStyle: text("card_style", { enum: CARD_STYLES })
      .notNull()
      .default("solid"),
    hideWatermark: integer("hide_watermark", { mode: "boolean" })
      .notNull()
      .default(false),
    customFaviconUrl: text("custom_favicon_url"),
    ogImageUrl: text("og_image_url"),
    trackingPixels: text("tracking_pixels"),
    /** Default WhatsApp number for WhatsApp checkout and the services page. */
    whatsappNumber: text("whatsapp_number"),
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("profiles_owner_idx").on(t.ownerId)]
);

export const socialLinks = sqliteTable(
  "social_links",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: SOCIAL_PLATFORMS }).notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("social_links_profile_idx").on(t.profileId, t.sortOrder)]
);

export const products = sqliteTable(
  "products",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    coverUrl: text("cover_url"),
    /** Price in whole rupiah. IDR has no minor unit in Midtrans, so 1 = Rp1. */
    priceAmount: integer("price_amount").notNull(),
    productType: text("product_type", { enum: PRODUCT_TYPES })
      .notNull()
      .default("digital"),
    status: text("status", { enum: PRODUCT_STATUSES })
      .notNull()
      .default("draft"),
    isFeatured: integer("is_featured", { mode: "boolean" })
      .notNull()
      .default(false),
    checkoutMethod: text("checkout_method", { enum: CHECKOUT_METHODS })
      .notNull()
      .default("whatsapp"),
    ctaLabel: text("cta_label"),
    /** Overrides the profile's WhatsApp number for this product. */
    whatsappNumber: text("whatsapp_number"),
    whatsappTemplate: text("whatsapp_template"),
    deliveryType: text("delivery_type", { enum: DELIVERY_TYPES })
      .notNull()
      .default("none"),
    /** Key inside private storage. Never served without a signed, paid-order check. */
    deliveryFileKey: text("delivery_file_key"),
    deliveryFileName: text("delivery_file_name"),
    deliveryFileSize: integer("delivery_file_size"),
    /** Secret link revealed only after payment. */
    deliveryUrl: text("delivery_url"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_profile_slug_idx").on(t.profileId, t.slug),
    index("products_profile_status_idx").on(t.profileId, t.status),
  ]
);

/** Codes buyers type at checkout, e.g. "1010" for 10% or Rp10.000 off. */
export const discountCodes = sqliteTable(
  "discount_codes",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Stored upper-case; what the buyer types is upper-cased before the lookup. */
    code: text("code").notNull(),
    discountType: text("discount_type", {
      enum: DISCOUNT_CODE_TYPES,
    }).notNull(),
    /** A percentage (1-99) or whole rupiah, depending on discountType. */
    discountValue: integer("discount_value").notNull(),
    /** Limits the code to one product; null means every product. */
    productId: text("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    /** Orders allowed in total (paid, or still waiting for payment); null means no limit. */
    maxUses: integer("max_uses"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("discount_codes_profile_code_idx").on(t.profileId, t.code),
  ]
);

/** The ordered list of blocks on the public profile: links, section headings and product cards. */
export const profileLinks = sqliteTable(
  "profile_links",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: LINK_KINDS }).notNull().default("link"),
    title: text("title"),
    description: text("description"),
    url: text("url"),
    /** Prefilled chat message for "whatsapp" blocks; the number comes from the profile. */
    message: text("message"),
    thumbnailUrl: text("thumbnail_url"),
    category: text("category"),
    layout: text("layout", { enum: LINK_LAYOUTS }).notNull().default("classic"),
    productId: text("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("profile_links_profile_idx").on(t.profileId, t.sortOrder),
    index("profile_links_product_idx").on(t.productId),
  ]
);

// ------------------------------------------------------------------ orders

export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    /** Public order number, also sent to Midtrans as order_id. */
    code: text("code").notNull().unique(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    buyerName: text("buyer_name").notNull(),
    buyerEmail: text("buyer_email").notNull(),
    buyerPhone: text("buyer_phone"),
    /** Total charged, after any discount code. */
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("IDR"),
    /** The code and the rupiah it took off are copied, so the history survives edits and deletes. */
    discountCodeId: text("discount_code_id").references(
      () => discountCodes.id,
      { onDelete: "set null" }
    ),
    discountCode: text("discount_code"),
    discountAmount: integer("discount_amount").notNull().default(0),
    status: text("status", { enum: ORDER_STATUSES })
      .notNull()
      .default("pending"),
    /**
     * The Midtrans account the payment was created on: the platform's, or the
     * seller's own. Webhooks and status checks for this order use that
     * account's key, whatever the profile is set to later.
     */
    paymentAccount: text("payment_account", { enum: MIDTRANS_MODES })
      .notNull()
      .default("platform"),
    /** SHA-256 of the buyer's order access token. */
    accessTokenHash: text("access_token_hash").notNull(),
    /** One per checkout form render, so a double submit reuses the same order. */
    idempotencyKey: text("idempotency_key").unique(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    /**
     * When each order email went out (server/email/order-emails.ts). Set
     * before sending and cleared again if the send fails, so every email
     * goes out once however many times the payment is confirmed.
     */
    paymentLinkEmailedAt: integer("payment_link_emailed_at", {
      mode: "timestamp_ms",
    }),
    /** Resend id of the scheduled payment-link email, cancelled once the order is paid. */
    paymentLinkEmailId: text("payment_link_email_id"),
    receiptEmailedAt: integer("receipt_emailed_at", { mode: "timestamp_ms" }),
    sellerEmailedAt: integer("seller_emailed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_profile_status_idx").on(t.profileId, t.status, t.createdAt),
    index("orders_product_idx").on(t.productId),
    index("orders_paid_idx").on(t.profileId, t.paidAt),
    index("orders_discount_code_idx").on(t.discountCodeId, t.status),
  ]
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    /** Normal price at the time of the order. */
    listAmount: integer("list_amount"),
    /** Price actually charged (after any discount code). */
    unitAmount: integer("unit_amount").notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)]
);

export const paymentTransactions = sqliteTable(
  "payment_transactions",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    snapToken: text("snap_token"),
    redirectUrl: text("redirect_url"),
    /** Raw provider status, e.g. settlement, pending, expire. */
    transactionStatus: text("transaction_status"),
    fraudStatus: text("fraud_status"),
    paymentType: text("payment_type"),
    grossAmount: integer("gross_amount").notNull(),
    statusCheckedAt: integer("status_checked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payment_tx_provider_order_idx").on(
      t.provider,
      t.providerOrderId
    ),
  ]
);

/** Every webhook delivery, keyed for idempotency. */
export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventKey: text("event_key").notNull(),
    orderCode: text("order_code"),
    payload: text("payload").notNull(),
    result: text("result"),
    receivedAt: createdAt(),
  },
  (t) => [uniqueIndex("webhook_events_key_idx").on(t.provider, t.eventKey)]
);

/** Download access granted to a paid order. Resolves the product's current file or link at access time. */
export const digitalDeliveries = sqliteTable("digital_deliveries", {
  id: id(),
  orderId: text("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  downloadCount: integer("download_count").notNull().default(0),
  maxDownloads: integer("max_downloads").notNull().default(10),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

// --------------------------------------------------------------- analytics

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: id(),
    /** Client-generated idempotency key. Duplicate keys are ignored. */
    eventKey: text("event_key").unique(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    linkId: text("link_id").references(() => profileLinks.id, {
      onDelete: "set null",
    }),
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type", { enum: EVENT_TYPES }).notNull(),
    /** Unix epoch milliseconds. */
    occurredAt: integer("occurred_at").notNull(),
    visitorId: text("visitor_id"),
    sessionId: text("session_id"),
    source: text("source", { enum: TRAFFIC_SOURCES }),
    referrerHost: text("referrer_host"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    device: text("device", { enum: DEVICES }),
  },
  (t) => [
    index("events_profile_type_time_idx").on(
      t.profileId,
      t.eventType,
      t.occurredAt
    ),
    index("events_link_time_idx").on(t.linkId, t.occurredAt),
    index("events_product_type_time_idx").on(
      t.productId,
      t.eventType,
      t.occurredAt
    ),
    index("events_dedupe_idx").on(t.visitorId, t.eventType, t.occurredAt),
  ]
);

// -------------------------------------------------------- platform & saas

export const platformSettings = sqliteTable("platform_settings", {
  id: text("id").primaryKey(),
  brandName: text("brand_name").notNull().default("Adhi Web Services"),
  brandTagline: text("brand_tagline").default(
    "Satu link untuk segala profil dan produk Anda"
  ),
  brandLogoUrl: text("brand_logo_url"),
  // Business contact for the Kontak, terms and refund pages. Entered by the
  // super admin; a page leaves out whatever is empty.
  businessName: text("business_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  businessAddress: text("business_address"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type SocialLink = typeof socialLinks.$inferSelect;
export type ProfileLink = typeof profileLinks.$inferSelect;
export type Product = typeof products.$inferSelect;
export type DiscountCode = typeof discountCodes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type DigitalDelivery = typeof digitalDeliveries.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type PlatformSettings = typeof platformSettings.$inferSelect;
