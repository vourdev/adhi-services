import { count, eq } from "drizzle-orm";

import { type Database, writeTransaction } from "@/db/client";
import {
  platformSettings,
  profileLinks,
  profiles,
  sessions,
  socialLinks,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/security";

/**
 * First-run setup: creates the owner account and their profile. Used by
 * `npm run setup`; there is deliberately no web sign-up.
 *
 * Starter content is limited to facts already verified for this site:
 * the owner's name, title, photo, banner, the social accounts confirmed live
 * on 2026-10-11 (LinkedIn, TikTok, GitHub), the CV email, the portfolio
 * (as a social icon, not a card) and the website-service card. No products
 * are created.
 */

/** From the owner's CV (Oct 2026): title, main stack and location. */
export const STARTER_BIO =
  "Software Developer · Frontend & Web Engineer. Membangun website dan aplikasi web dengan Next.js, React, Angular, dan Laravel. Bekasi, Indonesia.";

/**
 * The website-service card: opens WhatsApp with this message. It stays
 * hidden on the profile until a WhatsApp number is set in Settings.
 */
export const SERVICE_CARD = {
  kind: "whatsapp",
  title: "Jasa Pembuatan Website",
  description:
    "Company profile, website UMKM, landing page, dan portfolio. Konsultasi langsung lewat WhatsApp.",
  category: "Layanan",
  thumbnailUrl: "/jasa-pembuatan-website.webp",
  message:
    "Halo Adhi, saya tertarik membuat website. Saya ingin konsultasi mengenai kebutuhan, fitur, dan estimasi biayanya.",
  layout: "featured",
  isActive: true,
} as const;

export type OwnerInput = {
  email: string;
  password: string;
  name: string;
  username: string;
  role?: "super_admin" | "member";
  plan?: "free" | "premium";
};

export async function hasOwner(db: Database): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(users);
  return (row?.value ?? 0) > 0;
}

export async function createOwner(
  db: Database,
  input: OwnerInput,
  options: { starterContent?: boolean } = {}
) {
  const passwordHash = await hashPassword(input.password);
  return writeTransaction(db, async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        // Only the first-run setup creates the super admin, and it says so explicitly.
        role: input.role ?? "member",
        plan: input.plan ?? "free",
      })
      .returning();
    if (!user) throw new Error("Owner insert failed");

    const existingSettings = await tx.query.platformSettings.findFirst();
    if (!existingSettings) {
      await tx.insert(platformSettings).values({
        id: "default",
        brandName: "Adhi Web Services",
        brandTagline: "Satu link untuk segala profil dan produk Anda",
      });
    }

    const [profile] = await tx
      .insert(profiles)
      .values({
        ownerId: user.id,
        username: input.username,
        displayName: input.name,
        bio: options.starterContent ? STARTER_BIO : "",
        avatarUrl: options.starterContent ? "/adhi-nugroho-avatar.webp" : null,
        coverUrl: options.starterContent ? "/adhi-nugroho-banner.webp" : null,
      })
      .returning();
    if (!profile) throw new Error("Profile insert failed");

    if (options.starterContent) {
      await tx.insert(socialLinks).values([
        {
          profileId: profile.id,
          platform: "portfolio",
          url: "https://muhammadadhi.vour.dev/",
          sortOrder: 0,
        },
        {
          profileId: profile.id,
          platform: "linkedin",
          url: "https://www.linkedin.com/in/muhammadadhinugroho/",
          sortOrder: 1,
        },
        {
          profileId: profile.id,
          platform: "tiktok",
          url: "https://www.tiktok.com/@muhammad.adhinugroho",
          sortOrder: 2,
        },
        {
          profileId: profile.id,
          platform: "github",
          url: "https://github.com/vourdev",
          sortOrder: 3,
        },
        {
          profileId: profile.id,
          platform: "email",
          url: "mailto:muhammadadhi@vour.dev",
          sortOrder: 4,
        },
      ]);
      await tx
        .insert(profileLinks)
        .values({ ...SERVICE_CARD, profileId: profile.id, sortOrder: 0 });
    }
    return { user, profile };
  });
}

/** Sets a new password and signs the account out everywhere. */
export async function resetPassword(
  db: Database,
  email: string,
  password: string
): Promise<boolean> {
  const [user] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.email, email.toLowerCase()))
    .returning({ id: users.id });
  if (!user) return false;
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  return true;
}
