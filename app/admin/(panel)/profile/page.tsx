import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  type CardShape,
  type CardStyle,
  FONTS,
  type ThemePreset,
} from "@/lib/domain";
import { adminContext } from "@/server/admin";
import { getPublicProfile, listSocials } from "@/server/profile";

import { PageHeader } from "../../_components/page-header";
import { ProfileEditor } from "./_components/profile-editor";
import { SocialsManager } from "./_components/socials-manager";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage(): Promise<ReactNode> {
  const { db, owner, profileId } = await adminContext();
  const [preview, socials] = await Promise.all([
    getPublicProfile(db, owner.profile.username, { includeUnpublished: true }),
    listSocials(db, profileId),
  ]);
  if (!preview) notFound();
  const { profile } = owner;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Profile"
        description="Tampilan halaman publik Anda. Username dan nomor WhatsApp ada di Settings."
      />
      <ProfileEditor
        preview={preview}
        isPremium={owner.user.plan === "premium"}
        initial={{
          displayName: profile.displayName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl ?? "",
          coverUrl: profile.coverUrl ?? "",
          theme: profile.theme,
          accent: profile.accent,
          themePreset: (profile.themePreset as ThemePreset) ?? "default",
          customTheme: profile.customTheme ?? "",
          fontFamily:
            FONTS.find((font) => font === profile.fontFamily) ??
            "Plus Jakarta Sans",
          cardShape: (profile.cardShape as CardShape) ?? "smooth",
          cardStyle: (profile.cardStyle as CardStyle) ?? "solid",
          hideWatermark: Boolean(profile.hideWatermark),
          customFaviconUrl: profile.customFaviconUrl ?? "",
          ogImageUrl: profile.ogImageUrl ?? "",
        }}
      >
        <SocialsManager
          socials={socials.map(({ id, platform, url, isActive }) => ({
            id,
            platform,
            url,
            isActive,
          }))}
        />
      </ProfileEditor>
    </div>
  );
}
