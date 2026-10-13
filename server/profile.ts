import { and, asc, eq, inArray, max, sql } from "drizzle-orm";

import { type Database, writeTransaction } from "@/db/client";
import {
  products,
  profileLinks,
  profiles,
  socialLinks,
  users,
  type Product,
} from "@/db/schema";
import { linkIconFor } from "@/lib/link-icon";
import {
  FREE_PROFILE_LOOK,
  hasPremium,
  withoutPremiumFields,
} from "@/lib/plan";
import { type ProfileLook, visitorLook } from "@/lib/profile-look";
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

import { isProductionKey, sealServerKey } from "./payments/accounts";

/**
 * Profile, link and social-link data access. Every admin function takes the
 * owner's profileId from the session and includes it in the WHERE clause, so
 * a row belonging to another profile behaves as if it does not exist.
 */

// ------------------------------------------------------------------ public

export async function getPublicProfile(
  db: Database,
  username: string,
  options: { includeUnpublished?: boolean } = {},
  nowMs = Date.now()
): Promise<PublicProfile | null> {
  const [row] = await db
    .select({
      profile: profiles,
      owner: {
        role: users.role,
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
        status: users.status,
      },
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.ownerId))
    .where(eq(profiles.username, username))
    .limit(1);
  // A suspended owner's pages are offline for everyone, previews included.
  if (!row || row.owner.status !== "active") return null;
  const { profile } = row;
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

  // Premium styling shows only while the owner's plan is active. The stored
  // values stay, so they come back when premium is renewed.
  const look = hasPremium(row.owner, nowMs)
    ? {
        themePreset: profile.themePreset,
        customTheme: profile.customTheme,
        fontFamily: profile.fontFamily,
        cardShape: profile.cardShape,
        cardStyle: profile.cardStyle,
        hideWatermark: Boolean(profile.hideWatermark),
        customFaviconUrl: profile.customFaviconUrl,
        ogImageUrl: profile.ogImageUrl,
        trackingPixels: profile.trackingPixels,
      }
    : FREE_PROFILE_LOOK;

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

/**
 * A profile's look as visitors see it, for pages that do not load the whole
 * profile (the order page): premium styling only while the plan is active.
 */
export async function getVisitorLook(
  db: Database,
  profileId: string,
  nowMs = Date.now()
): Promise<ProfileLook | null> {
  const [row] = await db
    .select({
      profile: profiles,
      owner: {
        role: users.role,
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
      },
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.ownerId))
    .where(eq(profiles.id, profileId))
    .limit(1);
  return row ? visitorLook(row.profile, hasPremium(row.owner, nowMs)) : null;
}

function toProductCard(product: Product): PublicProductCard {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    priceAmount: product.priceAmount,
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
  };
}

/** The first profile created is the site's main profile, used for "/". */
export async function getPrimaryProfile(db: Database) {
  return db.query.profiles.findFirst({ orderBy: asc(profiles.createdAt) });
}

// ------------------------------------------------------------------ admin

/** Premium-only fields are dropped for a free owner, so the server enforces the plan, not the form. */
export async function updateProfile(
  db: Database,
  profileId: string,
  input: ProfileInput,
  options: { premium: boolean }
): Promise<Result> {
  const values = options.premium ? input : withoutPremiumFields(input);
  await db.update(profiles).set(values).where(eq(profiles.id, profileId));
  return ok();
}

/**
 * Username, WhatsApp, visibility and the Midtrans account. Only premium may
 * switch to their own Midtrans account or change its key; a free owner can
 * always switch back to the platform account. A new key is stored encrypted
 * and never returned.
 */
export async function updatePublicSettings(
  db: Database,
  profileId: string,
  input: PublicSettingsInput,
  options: { premium: boolean; encryptionSecret: string | null }
): Promise<Result<{ username: string }>> {
  const current = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: { midtransMode: true, customMidtransServerKey: true },
  });
  if (!current) return fail("Profil tidak ditemukan.");

  const {
    midtransMode,
    customMidtransServerKey: newKey,
    removeCustomMidtransServerKey,
    ...rest
  } = input;
  const values: Partial<typeof profiles.$inferInsert> = { ...rest };

  if (options.premium) {
    if (removeCustomMidtransServerKey) {
      values.customMidtransServerKey = null;
      values.customMidtransIsProduction = false;
    } else if (newKey) {
      if (!options.encryptionSecret) {
        console.error(
          "[settings] ENCRYPTION_KEY is not set; cannot store a Midtrans key"
        );
        return fail(
          "Server belum siap menyimpan kunci Midtrans. Hubungi admin platform."
        );
      }
      values.customMidtransServerKey = sealServerKey(
        profileId,
        newKey,
        options.encryptionSecret
      );
      values.customMidtransIsProduction = isProductionKey(newKey);
    }
    if (midtransMode) values.midtransMode = midtransMode;
    const keySaved =
      values.customMidtransServerKey !== undefined
        ? values.customMidtransServerKey !== null
        : current.customMidtransServerKey !== null;
    if (
      (values.midtransMode ?? current.midtransMode) === "custom" &&
      !keySaved
    ) {
      return fail("Isi Server Key Midtrans Anda untuk memakai akun sendiri.", {
        customMidtransServerKey: "Server Key wajib diisi.",
      });
    }
  } else if (midtransMode === "platform") {
    values.midtransMode = "platform";
  }

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
