import * as z from "zod";

import { normalizeHex } from "@/lib/color";
import { parseCustomTheme } from "@/lib/custom-theme";
import {
  ACCENTS,
  CARD_SHAPES,
  CARD_STYLES,
  CHECKOUT_METHODS,
  DELIVERY_TYPES,
  DISCOUNT_CODE_TYPES,
  FONTS,
  LINK_LAYOUTS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  PROFILE_THEMES,
  SOCIAL_PLATFORMS,
  THEME_PRESETS,
  type AccentHex,
  type SocialPlatform,
} from "@/lib/domain";
import { parseLocalWib } from "@/lib/pricing";
import { MAX_LINE_QUANTITY } from "@/lib/quantity";
import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from "@/lib/whatsapp";

// ------------------------------------------------------------------- URLs

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const MAX_URL_LENGTH = 2048;

/**
 * Destination check for profile links. Accepts http(s), mailto: and tel:
 * URLs, or an internal path such as /privasi. Rejects
 * javascript:, data:, protocol-relative URLs and embedded credentials.
 */
export function isSafeLinkUrl(value: string): boolean {
  const input = value.trim();
  if (!input || input.length > MAX_URL_LENGTH) return false;
  if (input.startsWith("/"))
    return !input.startsWith("//") && !input.includes("\\");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (!LINK_PROTOCOLS.has(url.protocol)) return false;
  if (url.protocol === "http:" || url.protocol === "https:") {
    if (!url.hostname || url.username || url.password) return false;
  }
  return true;
}

/** Image sources: https URLs or paths served by this site (/media/..., /avatar.webp). */
export function isSafeImageUrl(value: string): boolean {
  const input = value.trim();
  if (!input || input.length > MAX_URL_LENGTH) return false;
  if (input.startsWith("/"))
    return !input.startsWith("//") && !input.includes("\\");
  try {
    const url = new URL(input);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// --------------------------------------------------------------- username

export const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "go",
  "media",
  "download",
  "pesanan",
  "checkout",
  "login",
  "logout",
  "privasi",
  "settings",
  "dashboard",
  "static",
  "assets",
  "public",
  "robots",
  "sitemap",
  "favicon",
  "icon",
  "apple-icon",
  "_next",
]);

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .regex(
        USERNAME_PATTERN,
        "3-30 karakter: huruf kecil, angka, - atau _, diawali dan diakhiri huruf/angka."
      )
      .refine(
        (value) => !RESERVED_USERNAMES.has(value),
        "Username ini dipakai sistem, pilih yang lain."
      )
  );

// ------------------------------------------------------------------- slug

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// ------------------------------------------------------------------ money

export const MAX_PRICE = 1_000_000_000;

/** Parses "Rp 25.000", "25000" or 25000 into whole rupiah. Returns null for anything else. */
export function parseRupiah(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const digits = value.replace(/^\s*rp\.?\s*/i, "").replace(/[.\s]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
}

// ----------------------------------------------------------- shared parts

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const optionalImageUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .transform((value) => value ?? null)
  .refine(
    (value) => value === null || isSafeImageUrl(value),
    "Gunakan URL https atau unggah gambar."
  );

// ------------------------------------------------------------------ links

export const linkInputSchema = z
  .object({
    kind: z.enum(["link", "heading", "whatsapp"]),
    title: z
      .string()
      .trim()
      .min(1, "Judul wajib diisi.")
      .max(100, "Maksimal 100 karakter."),
    url: z.string().trim().max(MAX_URL_LENGTH).optional().default(""),
    /** Opening message for "whatsapp" links. */
    message: optionalText(1000),
    description: optionalText(160),
    thumbnailUrl: optionalImageUrl,
    category: optionalText(40),
    layout: z.enum(LINK_LAYOUTS).default("classic"),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "link" && !isSafeLinkUrl(value.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message:
          "URL tidak valid. Gunakan https://, mailto:, tel:, atau path internal seperti /halaman.",
      });
    }
    if (value.kind === "whatsapp" && !value.message) {
      ctx.addIssue({
        code: "custom",
        path: ["message"],
        message: "Tulis pesan awal yang muncul di chat WhatsApp.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    url: value.kind === "link" ? value.url.trim() : null,
    message: value.kind === "whatsapp" ? value.message : null,
  }));

export type LinkInput = z.output<typeof linkInputSchema>;

export const productBlockSchema = z.object({
  productId: z.uuid("Produk tidak valid."),
});

export const reorderSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
});

// ---------------------------------------------------------------- socials

export function normalizeSocialUrl(
  platform: SocialPlatform,
  raw: string
): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (platform === "email") {
    const email = value.replace(/^mailto:/i, "");
    return z.email().safeParse(email).success ? `mailto:${email}` : null;
  }
  if (platform === "whatsapp" && !/^https?:/i.test(value)) {
    return isValidWhatsAppNumber(value)
      ? `https://wa.me/${normalizeWhatsAppNumber(value)}`
      : null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") || url.username || url.password)
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const socialInputSchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    url: z.string().trim().min(1, "Isi URL atau alamat.").max(MAX_URL_LENGTH),
    isActive: z.boolean().default(true),
  })
  .transform((value, ctx) => {
    const url = normalizeSocialUrl(value.platform, value.url);
    if (!url) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message:
          value.platform === "email"
            ? "Alamat email tidak valid."
            : value.platform === "whatsapp"
              ? "Nomor WhatsApp atau URL tidak valid."
              : "Gunakan URL lengkap yang diawali https://.",
      });
      return z.NEVER;
    }
    return { ...value, url };
  });

export type SocialInput = z.output<typeof socialInputSchema>;

// ---------------------------------------------------------------- profile

/** A named accent, or a picked colour stored as "#rrggbb". */
const accentSchema = z.union([
  z.enum(ACCENTS),
  z.string().transform((value, ctx) => {
    const hex = normalizeHex(value);
    if (!hex) {
      ctx.addIssue({
        code: "custom",
        message: "Tulis kode warna seperti #2563eb.",
      });
      return z.NEVER;
    }
    return hex as AccentHex;
  }),
]);

export const profileInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(60, "Maksimal 60 karakter."),
  bio: z.string().trim().max(280, "Maksimal 280 karakter.").default(""),
  avatarUrl: optionalImageUrl,
  coverUrl: optionalImageUrl,
  theme: z.enum(PROFILE_THEMES),
  accent: accentSchema,
  themePreset: z.enum(THEME_PRESETS).optional(),
  /** Theme JSON. Checked value by value and stored normalized; empty clears it, omitted leaves it. */
  customTheme: z
    .string()
    .max(4000, "Tema kustom terlalu panjang.")
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      if (!value) return null;
      const theme = parseCustomTheme(value);
      if (!theme) {
        ctx.addIssue({ code: "custom", message: "Tema kustom tidak valid." });
        return z.NEVER;
      }
      return JSON.stringify(theme);
    }),
  fontFamily: z.enum(FONTS).optional(),
  cardShape: z.enum(CARD_SHAPES).optional(),
  cardStyle: z.enum(CARD_STYLES).optional(),
  hideWatermark: z.boolean().optional(),
  customFaviconUrl: optionalImageUrl,
  ogImageUrl: optionalImageUrl,
  trackingPixels: z.string().max(2000).nullable().optional(),
});

export type ProfileInput = z.output<typeof profileInputSchema>;

const whatsappNumberField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .transform((value) => value ?? null)
  .refine(
    (value) => value === null || isValidWhatsAppNumber(value),
    "Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxx."
  )
  .transform((value) =>
    value === null ? null : normalizeWhatsAppNumber(value)
  );

export const publicSettingsSchema = z.object({
  username: usernameSchema,
  whatsappNumber: whatsappNumberField,
  isPublished: z.boolean(),
});

export type PublicSettingsInput = z.output<typeof publicSettingsSchema>;

// --------------------------------------------------------------- products

export const WHATSAPP_PLACEHOLDERS = ["{produk}", "{harga}", "{link}"] as const;

export const DEFAULT_WHATSAPP_TEMPLATE =
  "Halo, saya tertarik dengan {produk} ({harga}). Boleh minta info lebih lanjut?\n\n{link}";

export const productInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Nama produk wajib diisi.")
      .max(120, "Maksimal 120 karakter."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(80, "Maksimal 80 karakter.")
      .regex(SLUG_PATTERN, "Slug hanya huruf kecil, angka, dan tanda hubung."),
    description: z
      .string()
      .trim()
      .max(5000, "Maksimal 5000 karakter.")
      .default(""),
    coverUrl: optionalImageUrl,
    priceAmount: z
      .number({ error: "Harga wajib diisi." })
      .int("Harga harus bilangan bulat.")
      .min(0, "Harga tidak boleh negatif.")
      .max(MAX_PRICE, "Harga terlalu besar."),
    compareAtAmount: z
      .number()
      .int("Harga harus bilangan bulat.")
      .min(1, "Harga coret minimal Rp1.")
      .max(MAX_PRICE, "Harga terlalu besar.")
      .nullable()
      .default(null),
    productType: z.enum(PRODUCT_TYPES),
    status: z.enum(PRODUCT_STATUSES),
    isFeatured: z.boolean().default(false),
    showOnProfile: z.boolean().default(true),
    checkoutMethod: z.enum(CHECKOUT_METHODS),
    ctaLabel: optionalText(32),
    minQuantity: z
      .number({ error: "Isi jumlah minimal." })
      .int("Harus bilangan bulat.")
      .min(1, "Minimal 1.")
      .max(MAX_LINE_QUANTITY, `Maksimal ${MAX_LINE_QUANTITY}.`)
      .default(1),
    maxQuantity: z
      .number()
      .int("Harus bilangan bulat.")
      .min(1, "Minimal 1.")
      .max(MAX_LINE_QUANTITY, `Maksimal ${MAX_LINE_QUANTITY}.`)
      .nullable()
      .default(null),
    whatsappNumber: whatsappNumberField,
    whatsappTemplate: optionalText(1000),
    deliveryType: z.enum(DELIVERY_TYPES).default("none"),
    deliveryFileKey: optionalText(200),
    deliveryFileName: optionalText(200),
    deliveryFileSize: z.number().int().min(0).nullable().default(null),
    deliveryUrl: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .optional()
      .transform((value) => value ?? null)
      .refine(
        (value) => value === null || /^https:\/\//i.test(value),
        "Link pengiriman harus diawali https://."
      ),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
  })
  .superRefine((value, ctx) => {
    if (value.checkoutMethod === "direct" && value.priceAmount < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["priceAmount"],
        message: "Checkout langsung butuh harga minimal Rp1.",
      });
    }
    if (
      value.compareAtAmount !== null &&
      value.compareAtAmount <= value.priceAmount
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAtAmount"],
        message: "Harga coret harus lebih tinggi dari harga jual.",
      });
    }
    if (value.maxQuantity !== null && value.maxQuantity < value.minQuantity) {
      ctx.addIssue({
        code: "custom",
        path: ["maxQuantity"],
        message: "Jumlah maksimal tidak boleh kurang dari jumlah minimal.",
      });
    }
    if (value.deliveryType === "link" && !value.deliveryUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryUrl"],
        message: "Isi link yang akan diberikan setelah pembayaran.",
      });
    }
    if (value.deliveryType === "file" && !value.deliveryFileKey) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryFileKey"],
        message: "Unggah file produk terlebih dahulu.",
      });
    }
    if (value.whatsappTemplate) {
      const missing = WHATSAPP_PLACEHOLDERS.filter(
        (token) => !value.whatsappTemplate?.includes(token)
      );
      if (missing.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["whatsappTemplate"],
          message: `Template harus memuat ${missing.join(", ")} agar pesan berisi nama produk, harga, dan link.`,
        });
      }
    }
  });

export type ProductInput = z.output<typeof productInputSchema>;
export type ProductFormValues = z.input<typeof productInputSchema>;

// --------------------------------------------------------- discount codes

const localDateTime = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => value || null)
  .refine(
    (value) => value === null || parseLocalWib(value) !== null,
    "Tanggal tidak valid."
  );

export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

/** Codes are case-insensitive: "hemat10" and "HEMAT10" are the same code. */
export function normalizeDiscountCode(value: string): string {
  return value.trim().toUpperCase();
}

export const discountCodeInputSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeDiscountCode)
      .pipe(
        z
          .string()
          .regex(
            DISCOUNT_CODE_PATTERN,
            "3-32 karakter: huruf, angka, - atau _, tanpa spasi."
          )
      ),
    discountType: z.enum(DISCOUNT_CODE_TYPES),
    discountValue: z
      .number({ error: "Isi besar potongan." })
      .int("Harus bilangan bulat.")
      .min(1, "Potongan minimal 1.")
      .max(MAX_PRICE, "Potongan terlalu besar."),
    /** Empty means the code works for every product. */
    productId: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((value) => value || null)
      .refine(
        (value) => value === null || z.uuid().safeParse(value).success,
        "Produk tidak valid."
      ),
    maxUses: z
      .number()
      .int("Harus bilangan bulat.")
      .min(1, "Minimal 1 kali.")
      .max(1_000_000, "Terlalu besar.")
      .nullable()
      .default(null),
    /** WIB wall-clock time from <input type="datetime-local">, converted to a Date by the service. */
    startsAt: localDateTime,
    endsAt: localDateTime,
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percent" && value.discountValue > 99) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Potongan persen antara 1 dan 99.",
      });
    }
    const startsAt = parseLocalWib(value.startsAt);
    const endsAt = parseLocalWib(value.endsAt);
    if (startsAt && endsAt && startsAt >= endsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Waktu berakhir harus setelah waktu mulai.",
      });
    }
  });

export type DiscountCodeInput = z.output<typeof discountCodeInputSchema>;
export type DiscountCodeFormValues = z.input<typeof discountCodeInputSchema>;

// ------------------------------------------------------------ auth/checkout

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email tidak valid.")),
  password: z.string().min(1, "Password wajib diisi.").max(200),
});

export const passwordSchema = z
  .string()
  .min(10, "Minimal 10 karakter.")
  .max(200, "Maksimal 200 karakter.")
  .regex(/[a-zA-Z]/, "Harus mengandung huruf.")
  .regex(/[0-9]/, "Harus mengandung angka.");

// --------------------------------------------------------- site settings

export const platformSettingsSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, "Nama brand wajib diisi.")
    .max(60, "Maksimal 60 karakter."),
  brandTagline: optionalText(120),
  brandLogoUrl: optionalImageUrl,
  businessName: optionalText(100),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null)
    .refine(
      (value) => value === null || z.email().safeParse(value).success,
      "Email kontak tidak valid."
    ),
  contactPhone: optionalText(30).refine(
    (value) => value === null || /^\+?[0-9][0-9 ()-]{6,}$/.test(value),
    "Nomor telepon tidak valid. Contoh: 0812 3456 7890."
  ),
  businessAddress: optionalText(300),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Isi password saat ini."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama.",
  });

/** Products in one order: a single "Beli sekarang" or the whole cart. */
export const MAX_CART_ITEMS = 20;

export const checkoutInputSchema = z.object({
  /** Each product once, with how many units; the limits are checked on the server. */
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
      })
    )
    .min(1, "Keranjang kosong.")
    .max(MAX_CART_ITEMS, `Maksimal ${MAX_CART_ITEMS} produk per pesanan.`)
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      "Produk ganda."
    ),
  idempotencyKey: z.uuid(),
  /** The total the buyer saw; checkout stops if it changed since (price edited, code ended). */
  expectedAmount: z.coerce.number().int().min(0),
  /** Discount code the buyer applied, if any. Looked up again on the server. */
  discountCode: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .transform((value) => normalizeDiscountCode(value ?? "") || null),
  buyerName: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(80, "Maksimal 80 karakter."),
  buyerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "Maksimal 120 karakter.")
    .pipe(z.email("Email tidak valid.")),
  buyerPhone: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null)
    .refine(
      (value) => value === null || isValidWhatsAppNumber(value),
      "Nomor HP tidak valid."
    )
    .transform((value) =>
      value === null ? null : normalizeWhatsAppNumber(value)
    ),
});

export type CheckoutInput = z.output<typeof checkoutInputSchema>;

/** Flattens zod issues into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    result[key] ??= issue.message;
  }
  return result;
}
