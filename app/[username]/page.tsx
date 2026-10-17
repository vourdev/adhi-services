import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { preload } from "react-dom";

import { ProfileFooter } from "@/components/profile/profile-footer";
import { ProfileSurface, ProfileView } from "@/components/profile/profile-view";
import { ViewBeacon } from "@/components/profile/view-beacon";
import { getDb } from "@/db/client";
import { lookFromProfile } from "@/lib/profile-look";
import { normalizeUsername } from "@/lib/validation";
import { loadProfile } from "@/server/public-data";
import { cartProducts, readCart } from "@/server/cart";
import { getPlatformSettings } from "@/server/platform-settings";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await loadProfile(
    normalizeUsername(decodeURIComponent((await params).username))
  );
  if (!loaded)
    return { title: "Profil tidak ditemukan", robots: { index: false } };
  const { profile } = loaded;
  const title = `${profile.displayName} (@${profile.username})`;
  const description =
    profile.bio ||
    `Semua link, produk, dan kontak ${profile.displayName} di satu halaman.`;
  const image = profile.ogImageUrl ?? profile.coverUrl ?? profile.avatarUrl;
  return {
    title,
    description,
    alternates: { canonical: `/${profile.username}` },
    icons: profile.customFaviconUrl
      ? { icon: profile.customFaviconUrl }
      : undefined,
    openGraph: {
      type: "profile",
      locale: "id_ID",
      url: `/${profile.username}`,
      title,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: profile.coverUrl ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function ProfilePage({
  params,
}: Props): Promise<ReactNode> {
  const { username: raw } = await params;
  const username = normalizeUsername(decodeURIComponent(raw));
  if (username !== raw) notFound();
  const loaded = await loadProfile(username);
  if (!loaded) notFound();
  const { profile, isOwner } = loaded;
  // Start the banner download from the document head: it is the largest thing on a phone screen.
  if (profile.coverUrl)
    preload(profile.coverUrl, { as: "image", fetchPriority: "high" });

  const [platform, cart] = await Promise.all([
    getPlatformSettings(getDb()),
    readCart().then((ids) => cartProducts(profile.id, ids)),
  ]);

  return (
    <ProfileSurface look={lookFromProfile(profile)}>
      {isOwner ? (
        <div className="bg-p-fg px-4 py-2 text-center text-xs text-p-bg">
          Anda masuk sebagai pemilik. Kunjungan dari browser ini tidak dihitung.{" "}
          {/* A full page load: the dashboard has its own theme and providers. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/admin"
            className="font-semibold underline underline-offset-2"
          >
            Buka dashboard
          </a>
        </div>
      ) : null}
      <ProfileView
        profile={profile}
        cartCount={cart.length}
        footer={
          <ProfileFooter
            name={profile.displayName}
            brandName={platform.brandName}
            hideWatermark={profile.hideWatermark}
          />
        }
      />
      <ViewBeacon type="profile_view" profileId={profile.id} />
    </ProfileSurface>
  );
}
