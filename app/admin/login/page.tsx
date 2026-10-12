import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentOwner } from "@/server/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({
  searchParams,
}: Props): Promise<ReactNode> {
  if (await getCurrentOwner()) redirect("/admin");
  const { next } = await searchParams;
  const target =
    typeof next === "string" && next.startsWith("/admin") ? next : "/admin";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Masuk ke dashboard</CardTitle>
          <CardDescription>
            Kelola profil, link, produk, dan lihat statistik kunjungan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={target} />
        </CardContent>
      </Card>
    </main>
  );
}
