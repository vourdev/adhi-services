import { and, asc, eq, inArray, max, sql } from "drizzle-orm";

import { type Database, writeTransaction } from "@/db/client";
import {
  products,
  profileLinks,
  profiles,
  socialLinks,
  type Product,
} from "@/db/schema";
import { linkIconFor } from "@/lib/link-icon";
import { quantityLimits } from "@/lib/quantity";
import { lookFromProfile, type ProfileLook } from "@/lib/profile-look";
import type {
  PublicBlock,
  PublicProduct,
  PublicProductCard,
  PublicProfile,
} from "@/lib/public-types";
import { fail, isUniqueViolation, ok, type Result } from "@/lib/result";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";
import type {
  LinkInput,
  ProfileInput,
  PublicSettingsInput,
  SocialInput,
} from "@/lib/validation";

/**
 * Profile, link and social-link data access. Every admin function takes the
 * owner's profileId from the session and includes it in the WHERE clause, so
 * a row belonging to another profile behaves as if it does not exist.
 */

// ------------------------------------------------------------------ public

export async function getPublicProfile(
  db: Database,
  username: string,
  options: { includeUnpublished?: boolean } = {}
): Promise<PublicProfile | null> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.username, username),
  });
  if (!profile) return null;
  if (!profile.isPublished && !options.includeUnpublished) return null;

  const [socials, rows] = await Promise.all([
    db
      .select({
        id: socialLinks.id,
        platform: socialLinks.platform,
        url: socialLinks.url,
      })
      .from(socialLinks)
      .where(
        and(
          eq(socialLinks.profileId, profile.id),
          eq(socialLinks.isActive, true)
        )
      )
      .orderBy(asc(socialLinks.sortOrder), asc(socialLinks.createdAt)),
    db
      .select({ link: profileLinks, product: products })
      .from(profileLinks)
      .leftJoin(products, eq(products.id, profileLinks.productId))
      .where(
        and(
          eq(profileLinks.profileId, profile.id),
          eq(profileLinks.isActive, true)
        )
      )
      .orderBy(asc(profileLinks.sortOrder), asc(profileLinks.createdAt)),
  ]);

  // WhatsApp blocks need the profile's number; without it they stay hidden.
  const whatsappReady = Boolean(
    profile.whatsappNumber && isValidWhatsAppNumber(profile.whatsappNumber)
  );
  const blocks: PublicBlock[] = [];
  for (const { link, product } of rows) {
    if (link.kind === "heading" && link.title) {
      blocks.push({ type: "heading", id: link.id, title: link.title });
    } else if (link.kind === "link" && link.title && link.url) {
      blocks.push({
        type: "link",
        id: link.id,
        title: link.title,
        description: link.description,
        thumbnailUrl: link.thumbnailUrl,
        category: link.category,
        layout: link.layout,
        icon: linkIconFor(link.url),
        href: `/go/l/${link.id}`,
      });
    } else if (
      link.kind === "whatsapp" &&
      link.title &&
      link.message &&
      whatsappReady
    ) {
      blocks.push({
        type: "link",
        id: link.id,
        title: link.title,
        description: link.description,
        thumbnailUrl: link.thumbnailUrl,
        category: link.category,
        layout: link.layout,
        icon: "whatsapp",
        href: `/go/l/${link.id}`,
      });
    } else if (
      link.kind === "product" &&
      product &&
      product.status === "published"
    ) {
      blocks.push({
        type: "product",
        id: link.id,
        product: toProductCard(product),
        href: `/go/p/${product.id}`,
      });
    }
  }

  // Drop headings that have nothing under them before the next heading.
  const visible = blocks.filter(
    (block, index) =>
      block.type !== "heading" ||
      (blocks[index + 1] !== undefined && blocks[index + 1]?.type !== "heading")
  );

  const look = {
    themePreset: profile.themePreset,
    customTheme: profile.customTheme,
    fontFamily: profile.fontFamily,
    cardShape: profile.cardShape,
    cardStyle: profile.cardStyle,
    hideWatermark: Boolean(profile.hideWatermark),
    customFaviconUrl: profile.customFaviconUrl,
    ogImageUrl: profile.ogImageUrl,
    trackingPixels: profile.trackingPixels,
  };

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    theme: profile.theme,
    accent: profile.accent,
    ...look,
    socials,
    blocks: visible,
  };
}

/** A profile's look, for pages that do not load the whole profile (the order page). */
export async function getVisitorLook(
  db: Database,
  profileId: string
): Promise<ProfileLook | null> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
  });
  return profile ? lookFromProfile(profile) : null;
}

function toProductCard(product: Product): PublicProductCard {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    priceAmount: product.priceAmount,
    // Only a higher earlier price is a sale.
    compareAtAmount:
      product.compareAtAmount !== null &&
      product.compareAtAmount > product.priceAmount
        ? product.compareAtAmount
        : null,
    coverUrl: product.coverUrl,
    isFeatured: product.isFeatured,
    productType: product.productType,
    checkoutMethod: product.checkoutMethod,
  };
}

export function toPublicProduct(product: Product): PublicProduct {
  return {
    ...toProductCard(product),
    description: product.description,
    ctaLabel: product.ctaLabel,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    status: product.status,
    hasDelivery: product.deliveryType !== "none",
    limits: quantityLimits(product),
  };
}

/** The first profile created is the site's main profile, used for "/". */
export async function getPrimaryProfile(db: Database) {
  return db.query.profiles.findFirst({ orderBy: asc(profiles.createdAt) });
}

// ------------------------------------------------------------------ admin

export async function updateProfile(
  db: Database,
  profileId: string,
  input: ProfileInput
): Promise<Result> {
  await db.update(profiles).set(input).where(eq(profiles.id, profileId));
  return ok();
}

/** Username, WhatsApp number and visibility. */
export async function updatePublicSettings(
  db: Database,
  profileId: string,
  input: PublicSettingsInput
): Promise<Result<{ username: string }>> {
  const values: Partial<typeof profiles.$inferInsert> = { ...input };

  try {
    await db.update(profiles).set(values).where(eq(profiles.id, profileId));
    return ok({ username: input.username });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("Username sudah dipakai.", {
        username: "Username sudah dipakai profil lain.",
      });
    }
    throw error;
  }
}

// ------------------------------------------------------------------ links

export type AdminLink = typeof profileLinks.$inferSelect & {
  product: {
    id: string;
    name: string;
    status: "draft" | "published";
    coverUrl: string | null;
  } | null;
};

export async function listLinks(
  db: Database,
  profileId: string
): Promise<AdminLink[]> {
  const rows = await db
    .select({
      link: profileLinks,
      productId: products.id,
      productName: products.name,
      productStatus: products.status,
      productCover: products.coverUrl,
    })
    .from(profileLinks)
    .leftJoin(products, eq(products.id, profileLinks.productId))
    .where(eq(profileLinks.profileId, profileId))
    .orderBy(asc(profileLinks.sortOrder), asc(profileLinks.createdAt));

  return rows.map((row) => ({
    ...row.link,
    product:
      row.productId && row.productName && row.productStatus
        ? {
            id: row.productId,
            name: row.productName,
            status: row.productStatus,
            coverUrl: row.productCover,
          }
        : null,
  }));
}

async function nextSortOrder(db: Database, profileId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(profileLinks.sortOrder) })
    .from(profileLinks)
    .where(eq(profileLinks.profileId, profileId));
  return (row?.value ?? -1) + 1;
}

export async function createLink(
  db: Database,
  profileId: string,
  input: LinkInput
): Promise<Result<{ id: string }>> {
  const [row] = await db
    .insert(profileLinks)
    .values({
      ...input,
      profileId,
      sortOrder: await nextSortOrder(db, profileId),
    })
    .returning({ id: profileLinks.id });
  return row ? ok({ id: row.id }) : fail("Link gagal disimpan.");
}

export async function updateLink(
  db: Database,
  profileId: string,
  id: string,
  input: LinkInput
): Promise<Result> {
  const [row] = await db
    .update(profileLinks)
    .set({ ...input, productId: null })
    .where(
      and(
        eq(profileLinks.id, id),
        eq(profileLinks.profileId, profileId),
        inArray(profileLinks.kind, ["link", "heading", "whatsapp"])
      )
    )
    .returning({ id: profileLinks.id });
  return row ? ok() : fail("Link tidak ditemukan.");
}

export async function setLinkActive(
  db: Database,
  profileId: string,
  id: string,
  isActive: boolean
): Promise<Result> {
  const [row] = await db
    .update(profileLinks)
    .set({ isActive })
    .where(and(eq(profileLinks.id, id), eq(profileLinks.profileId, profileId)))
    .returning({ id: profileLinks.id });
  return row ? ok() : fail("Link tidak ditemukan.");
}

export async function deleteLink(
  db: Database,
  profileId: string,
  id: string
): Promise<Result> {
  const [row] = await db
    .delete(profileLinks)
    .where(and(eq(profileLinks.id, id), eq(profileLinks.profileId, profileId)))
    .returning({ id: profileLinks.id });
  return row ? ok() : fail("Link tidak ditemukan.");
}

/** Rewrites sort order to match `ids`, which must be exactly the profile's blocks. */
export async function reorderLinks(
  db: Database,
  profileId: string,
  ids: string[]
): Promise<Result> {
  const existing = await db
    .select({ id: profileLinks.id })
    .from(profileLinks)
    .where(eq(profileLinks.profileId, profileId));
  const known = new Set(existing.map((row) => row.id));
  if (
    ids.length !== known.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !known.has(id))
  ) {
    return fail("Urutan tidak valid. Muat ulang halaman lalu coba lagi.");
  }
  await writeTransaction(db, async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(profileLinks)
        .set({ sortOrder: index })
        .where(
          and(eq(profileLinks.id, id), eq(profileLinks.profileId, profileId))
        );
    }
  });
  return ok();
}

/** Adds a product card to the profile, unless it is already there. */
export async function addProductBlock(
  db: Database,
  profileId: string,
  productId: string
): Promise<Result> {
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.profileId, profileId)),
  });
  if (!product) return fail("Produk tidak ditemukan.");
  const existing = await db.query.profileLinks.findFirst({
    where: and(
      eq(profileLinks.profileId, profileId),
      eq(profileLinks.productId, productId)
    ),
  });
  if (existing) return ok();
  await db.insert(profileLinks).values({
    profileId,
    kind: "product",
    productId,
    sortOrder: await nextSortOrder(db, profileId),
  });
  return ok();
}

export async function removeProductBlock(
  db: Database,
  profileId: string,
  productId: string
): Promise<void> {
  await db
    .delete(profileLinks)
    .where(
      and(
        eq(profileLinks.profileId, profileId),
        eq(profileLinks.productId, productId)
      )
    );
}

// ---------------------------------------------------------------- socials

export async function listSocials(db: Database, profileId: string) {
  return db
    .select()
    .from(socialLinks)
    .where(eq(socialLinks.profileId, profileId))
    .orderBy(asc(socialLinks.sortOrder), asc(socialLinks.createdAt));
}

export async function createSocial(
  db: Database,
  profileId: string,
  input: SocialInput
): Promise<Result<{ id: string }>> {
  const [last] = await db
    .select({ value: max(socialLinks.sortOrder) })
    .from(socialLinks)
    .where(eq(socialLinks.profileId, profileId));
  const [row] = await db
    .insert(socialLinks)
    .values({ ...input, profileId, sortOrder: (last?.value ?? -1) + 1 })
    .returning({ id: socialLinks.id });
  return row ? ok({ id: row.id }) : fail("Gagal menyimpan.");
}

export async function updateSocial(
  db: Database,
  profileId: string,
  id: string,
  input: SocialInput
): Promise<Result> {
  const [row] = await db
    .update(socialLinks)
    .set(input)
    .where(and(eq(socialLinks.id, id), eq(socialLinks.profileId, profileId)))
    .returning({ id: socialLinks.id });
  return row ? ok() : fail("Media sosial tidak ditemukan.");
}

export async function deleteSocial(
  db: Database,
  profileId: string,
  id: string
): Promise<Result> {
  const [row] = await db
    .delete(socialLinks)
    .where(and(eq(socialLinks.id, id), eq(socialLinks.profileId, profileId)))
    .returning({ id: socialLinks.id });
  return row ? ok() : fail("Media sosial tidak ditemukan.");
}

export async function reorderSocials(
  db: Database,
  profileId: string,
  ids: string[]
): Promise<Result> {
  const existing = await db
    .select({ id: socialLinks.id })
    .from(socialLinks)
    .where(eq(socialLinks.profileId, profileId));
  const known = new Set(existing.map((row) => row.id));
  if (
    ids.length !== known.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !known.has(id))
  ) {
    return fail("Urutan tidak valid. Muat ulang halaman lalu coba lagi.");
  }
  await writeTransaction(db, async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(socialLinks)
        .set({ sortOrder: index })
        .where(
          and(eq(socialLinks.id, id), eq(socialLinks.profileId, profileId))
        );
    }
  });
  return ok();
}

export async function countBlocks(
  db: Database,
  profileId: string
): Promise<{ total: number; active: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`coalesce(sum(case when ${profileLinks.isActive} then 1 else 0 end), 0)`,
    })
    .from(profileLinks)
    .where(eq(profileLinks.profileId, profileId));
  return { total: Number(row?.total ?? 0), active: Number(row?.active ?? 0) };
}
