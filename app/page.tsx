import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { getDb } from "@/db/client";
import { getPrimaryProfile } from "@/server/profile";

/** "/" sends visitors to the owner's profile; before setup it explains what to do. */
export default async function Home(): Promise<ReactNode> {
  await connection();
  const profile = await getPrimaryProfile(getDb());
  if (profile?.isPublished) redirect(`/${profile.username}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Profil belum tersedia
      </h1>
      <p className="text-muted-foreground">
        {profile
          ? "Profil sedang tidak dipublikasikan."
          : "Belum ada akun pemilik. Jalankan npm run setup untuk membuat akun dan profil."}
      </p>
      <Link
        href="/admin"
        className="text-sm font-medium underline underline-offset-4"
      >
        Masuk ke dashboard
      </Link>
    </main>
  );
}
