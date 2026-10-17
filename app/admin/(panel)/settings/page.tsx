import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { blobStorageEnabled, hasPublicSiteUrl, siteUrl, storageDir } from "@/lib/env";
import { adminContext, ownerPayments } from "@/server/admin";
import { IGNORE_COOKIE } from "@/server/analytics/visitor";
import { countActiveSessions } from "@/server/auth";
import { getPlatformSettings } from "@/server/platform-settings";

import { PageHeader } from "../../_components/page-header";
import { BrandForm } from "./_components/brand-form";
import { MidtransDashboardUrls } from "./_components/midtrans-urls";
import { PublicSettingsForm } from "./_components/public-settings-form";
import {
  ChangePasswordForm,
  LogoutEverywhere,
  TrackingExclusion,
} from "./_components/security-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage(): Promise<ReactNode> {
  const { db, owner } = await adminContext();
  const [sessions, cookieStore, platform] = await Promise.all([
    countActiveSessions(db, owner.user.id),
    cookies(),
    getPlatformSettings(db),
  ]);
  const { status: payments, problem } = ownerPayments();
  const { profile } = owner;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Settings"
        description="URL publik, kontak, analytics, pembayaran, dan keamanan akun."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profil publik</CardTitle>
        </CardHeader>
        <CardContent>
          <PublicSettingsForm
            siteUrl={siteUrl()}
            username={profile.username}
            whatsappNumber={profile.whatsappNumber ?? ""}
            isPublished={profile.isPublished}
          />
        </CardContent>
      </Card>

      <BrandForm settings={platform} />

      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>
            Statistik dicatat di server sendiri dengan cookie pihak pertama.
            Tidak ada layanan analytics pihak ketiga.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrackingExclusion
            excluded={cookieStore.get(IGNORE_COOKIE)?.value === "1"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pembayaran (Midtrans)
            {payments.ready ? (
              <Badge
                className={
                  payments.mode === "production"
                    ? "bg-success/10 text-success"
                    : ""
                }
                variant={
                  payments.mode === "production" ? "default" : "secondary"
                }
              >
                {payments.mode === "production" ? "Production" : "Sandbox"}
              </Badge>
            ) : (
              <Badge variant="secondary">Belum aktif</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Kunci Midtrans disimpan di environment server (MIDTRANS_SERVER_KEY),
            tidak bisa diubah dari dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {payments.ready ? (
            <p>
              Checkout langsung aktif dalam mode{" "}
              {payments.mode === "production"
                ? "production (transaksi sungguhan)"
                : "sandbox (uji coba, tidak ada uang sungguhan)"}
              .
            </p>
          ) : (
            <p className="text-muted-foreground">{problem}</p>
          )}
          <div className="border-t pt-3">
            <MidtransDashboardUrls
              siteUrl={siteUrl()}
              publicSite={hasPublicSiteUrl()}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Akun</CardTitle>
          <CardDescription>Masuk sebagai {owner.user.email}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ChangePasswordForm />
          <LogoutEverywhere sessions={sessions} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {blobStorageEnabled()
          ? "Penyimpanan file: Vercel Blob (store privat) untuk gambar dan file produk."
          : `Penyimpanan file: ${storageDir()} (gambar publik dan file produk privat). Butuh disk persisten di server production, atau hubungkan Vercel Blob.`}
      </p>
    </div>
  );
}
