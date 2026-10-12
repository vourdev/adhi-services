import { and, asc, count, desc, eq, like, or, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { orders, products, profileLinks, type Product } from "@/db/schema";
import type { CheckoutMethod, ProductStatus } from "@/lib/domain";
import { fail, isUniqueViolation, ok, type Result } from "@/lib/result";
import type { ProductInput } from "@/lib/validation";
import { DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/validation";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";

import { addProductBlock, removeProductBlock } from "./profile";
import { privateFileExists } from "./storage";

/**
 * Product catalogue. Checkout method is per product; WhatsApp and direct
 * checkout products live side by side.
 */

export type PublishContext = {
  /** Profile-level default WhatsApp number. */
  profileWhatsapp: string | null;
  /** True when Midtrans credentials and a public SITE_URL are configured. */
  paymentsReady: boolean;
};

/** Rules a product must meet before it can be published. Returns { field: message }. */
export function publishProblems(
  input: ProductInput,
  context: PublishContext
): Record<string, string> {
  const problems: Record<string, string> = {};
  if (input.checkoutMethod === "whatsapp") {
    const number = input.whatsappNumber ?? context.profileWhatsapp;
    if (!number || !isValidWhatsAppNumber(number)) {
      problems.whatsappNumber =
        "Isi nomor WhatsApp di produk ini atau di Pengaturan sebelum dipublikasikan.";
    }
  }
  if (input.checkoutMethod === "direct" && !context.paymentsReady) {
    problems.checkoutMethod =
      "Checkout langsung belum bisa dipakai: MIDTRANS_SERVER_KEY dan SITE_URL (https) belum diatur. Simpan sebagai draf atau pilih WhatsApp.";
  }
  if (
    input.checkoutMethod === "direct" &&
    input.productType !== "service" &&
    input.deliveryType === "none"
  ) {
    problems.deliveryType =
      "Produk digital dengan checkout langsung butuh file atau link pengiriman.";
  }
  return problems;
}

async function validateDeliveryFile(
  input: ProductInput
): Promise<Record<string, string>> {
  if (
    input.deliveryType === "file" &&
    input.deliveryFileKey &&
    !(await privateFileExists(input.deliveryFileKey))
  ) {
    return { deliveryFileKey: "File produk tidak ditemukan. Unggah ulang." };
  }
  return {};
}

function toRow(input: ProductInput) {
  const { showOnProfile: _showOnProfile, ...rest } = input;
  return {
    ...rest,
    whatsappTemplate: input.whatsappTemplate ?? null,
    deliveryFileKey:
      input.deliveryType === "file" ? input.deliveryFileKey : null,
    deliveryFileName:
      input.deliveryType === "file" ? input.deliveryFileName : null,
    deliveryFileSize:
      input.deliveryType === "file" ? input.deliveryFileSize : null,
    deliveryUrl: input.deliveryType === "link" ? input.deliveryUrl : null,
  };
}

export async function createProduct(
  db: Database,
  profileId: string,
  input: ProductInput,
  context: PublishContext
): Promise<Result<{ id: string }>> {
  const problems = {
    ...(input.status === "published" ? publishProblems(input, context) : {}),
    ...(await validateDeliveryFile(input)),
  };
  if (Object.keys(problems).length > 0)
    return fail("Periksa kembali isian produk.", problems);

  try {
    const [row] = await db
      .insert(products)
      .values({ ...toRow(input), profileId })
      .returning({ id: products.id });
    if (!row) return fail("Produk gagal disimpan.");
    if (input.showOnProfile) await addProductBlock(db, profileId, row.id);
    return ok({ id: row.id });
  } catch (error) {
    if (isUniqueViolation(error))
      return fail("Slug sudah dipakai.", {
        slug: "Slug sudah dipakai produk lain.",
      });
    throw error;
  }
}

export async function updateProduct(
  db: Database,
  profileId: string,
  id: string,
  input: ProductInput,
  context: PublishContext
): Promise<Result> {
  const existing = await getProduct(db, profileId, id);
  if (!existing) return fail("Produk tidak ditemukan.");

  const problems = {
    ...(input.status === "published" ? publishProblems(input, context) : {}),
    ...(await validateDeliveryFile(input)),
  };
  if (Object.keys(problems).length > 0)
    return fail("Periksa kembali isian produk.", problems);

  try {
    await db
      .update(products)
      .set(toRow(input))
      .where(and(eq(products.id, id), eq(products.profileId, profileId)));
  } catch (error) {
    if (isUniqueViolation(error))
      return fail("Slug sudah dipakai.", {
        slug: "Slug sudah dipakai produk lain.",
      });
    throw error;
  }

  if (input.showOnProfile) await addProductBlock(db, profileId, id);
  else await removeProductBlock(db, profileId, id);
  return ok();
}

/** Products with orders cannot be deleted (the order history needs them); set them to draft instead. */
export async function deleteProduct(
  db: Database,
  profileId: string,
  id: string
): Promise<Result> {
  const existing = await getProduct(db, profileId, id);
  if (!existing) return fail("Produk tidak ditemukan.");
  const [orderCount] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.productId, id));
  if ((orderCount?.value ?? 0) > 0) {
    return fail(
      "Produk ini sudah punya pesanan, jadi tidak bisa dihapus. Ubah statusnya ke draf agar tidak tampil."
    );
  }
  await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.profileId, profileId)));
  return ok();
}

export async function getProduct(
  db: Database,
  profileId: string,
  id: string
): Promise<Product | undefined> {
  return db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.profileId, profileId)),
  });
}

export async function isOnProfile(
  db: Database,
  profileId: string,
  productId: string
): Promise<boolean> {
  const row = await db.query.profileLinks.findFirst({
    where: and(
      eq(profileLinks.profileId, profileId),
      eq(profileLinks.productId, productId)
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function getProductBySlug(
  db: Database,
  profileId: string,
  slug: string
): Promise<Product | undefined> {
  return db.query.products.findFirst({
    where: and(eq(products.profileId, profileId), eq(products.slug, slug)),
  });
}

export const PRODUCT_SORTS = [
  "updated",
  "name",
  "price-asc",
  "price-desc",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const PRODUCTS_PAGE_SIZE = 20;

export async function listProducts(
  db: Database,
  profileId: string,
  options: {
    query?: string;
    status?: ProductStatus | undefined;
    method?: CheckoutMethod | undefined;
    sort?: ProductSort;
    page?: number;
  } = {}
) {
  const conditions: SQL[] = [eq(products.profileId, profileId)];
  const query = options.query?.replace(/[%_]/g, "").trim().slice(0, 100);
  if (query) {
    const pattern = `%${query}%`;
    const search = or(
      like(products.name, pattern),
      like(products.slug, pattern)
    );
    if (search) conditions.push(search);
  }
  if (options.status) conditions.push(eq(products.status, options.status));
  if (options.method)
    conditions.push(eq(products.checkoutMethod, options.method));

  const orderBy = {
    updated: [desc(products.updatedAt)],
    name: [asc(products.name)],
    "price-asc": [asc(products.priceAmount), asc(products.name)],
    "price-desc": [desc(products.priceAmount), asc(products.name)],
  }[options.sort ?? "updated"];

  const page = Math.max(1, Math.floor(options.page ?? 1));
  const where = and(...conditions);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(...orderBy)
      .limit(PRODUCTS_PAGE_SIZE)
      .offset((page - 1) * PRODUCTS_PAGE_SIZE),
    db.select({ value: count() }).from(products).where(where),
  ]);
  const totalCount = total?.value ?? 0;
  return {
    rows,
    total: totalCount,
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / PRODUCTS_PAGE_SIZE)),
  };
}

export function whatsappTemplateFor(
  product: Pick<Product, "whatsappTemplate">
): string {
  return product.whatsappTemplate ?? DEFAULT_WHATSAPP_TEMPLATE;
}
