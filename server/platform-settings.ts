import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { platformSettings, type PlatformSettings } from "@/db/schema";

/** Site-wide brand and business contact, edited in Settings. One row, id "default". */

export async function getPlatformSettings(
  db: Database
): Promise<PlatformSettings> {
  const existing = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.id, "default"),
  });
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(platformSettings)
    .values({
      id: "default",
      brandName: "Adhi Web Services",
      brandTagline: "Satu link untuk segala profil dan produk Anda",
    })
    .onConflictDoNothing()
    .returning();
  if (created) {
    return created;
  }
  return {
    id: "default",
    brandName: "Adhi Web Services",
    brandTagline: "Satu link untuk segala profil dan produk Anda",
    brandLogoUrl: null,
    businessName: null,
    contactEmail: null,
    contactPhone: null,
    businessAddress: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updatePlatformSettings(
  db: Database,
  input: {
    brandName: string;
    brandTagline?: string;
    brandLogoUrl?: string;
    /** Left out: unchanged. Empty string: cleared. */
    businessName?: string;
    contactEmail?: string;
    contactPhone?: string;
    businessAddress?: string;
  }
) {
  const brandName = input.brandName.trim();
  if (!brandName) {
    return { ok: false, error: "Nama brand wajib diisi." };
  }
  const contact: Partial<
    Record<
      "businessName" | "contactEmail" | "contactPhone" | "businessAddress",
      string | null
    >
  > = {};
  for (const key of [
    "businessName",
    "contactEmail",
    "contactPhone",
    "businessAddress",
  ] as const) {
    const value = input[key];
    if (value !== undefined) contact[key] = value.trim() || null;
  }

  await db
    .insert(platformSettings)
    .values({
      id: "default",
      brandName,
      brandTagline: input.brandTagline?.trim() || null,
      brandLogoUrl: input.brandLogoUrl?.trim() || null,
      ...contact,
    })
    .onConflictDoUpdate({
      target: platformSettings.id,
      set: {
        brandName,
        brandTagline: input.brandTagline?.trim() || null,
        brandLogoUrl: input.brandLogoUrl?.trim() || null,
        ...contact,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}
