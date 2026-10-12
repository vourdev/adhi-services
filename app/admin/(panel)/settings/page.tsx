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
import {
  encryptionSecret,
  hasPublicSiteUrl,
  siteUrl,
  storageDir,
} from "@/lib/env";
import { adminContext, ownerPayments } from "@/server/admin";
import { IGNORE_COOKIE } from "@/server/analytics/visitor";
import { countActiveSessions } from "@/server/auth";
import { paymentsStatus, savedServerKeyHint } from "@/server/payments";

import { CopyButton } from "../../_components/copy-button";
import { PageHeader } from "../../_components/page-header";
import { PublicSettingsForm } from "./_components/public-settings-form";
import {
  ChangePasswordForm,
  LogoutEverywhere,
  TrackingExclusion,
} from "./_components/security-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage(): Promise<ReactNode> {
  const { db, owner } = await adminContext();
  const [sessions, cookieStore] = await Promise.all([
    countActiveSessions(db, owner.user.id),
    cookies(),
  ]);
  const isSuperAdmin = owner.user.role === "super_admin";
  const { status: payments, problem } = ownerPayments(owner);
  const { profile } = owner;
  // Only a hint of the saved key leaves the server, never the key itself.
  const savedKey = profile.customMidtransServerKey
    ? {
        hint: savedServerKeyHint(profile),
        production: profile.customMidtransIsProduction,
      }
    : null;

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
            midtransMode={profile.midtransMode}
            premium={owner.user.plan === "premium"}
            savedKey={savedKey}
          />
        </CardContent>
      </Card>

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
            {payments.ready
              ? payments.account === "custom"
                ? "Pembayaran pembeli masuk ke akun Midtrans Anda sendiri."
                : "Pembayaran pembeli masuk ke akun Midtrans platform."
              : payments.account === "custom"
                ? "Diatur ke akun Midtrans Anda sendiri."
                : "Diatur ke akun Midtrans platform."}
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
          {isSuperAdmin ? <PlatformPaymentsAdmin /> : null}
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

      {isSuperAdmin ? (
        <p className="text-xs text-muted-foreground">
          Penyimpanan file: {storageDir()} (gambar publik dan file produk
          privat). Butuh disk persisten di server production.
        </p>
      ) : null}
    </div>
  );
}

/** Server configuration for the platform account. Shown to the super admin only. */
function PlatformPaymentsAdmin(): ReactNode {
  const platform = paymentsStatus();
  const webhookUrl = `${siteUrl()}/api/payments/midtrans`;
  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <span className="text-xs font-medium text-muted-foreground">
        Akun platform (hanya terlihat oleh Super Admin)
      </span>
      {platform.ready ? (
        <p className="text-xs text-muted-foreground">
          Kunci platform aktif ({platform.mode}). Kunci API platform disimpan di
          environment server, tidak bisa diubah dari dashboard.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Isi{" "}
          {platform.missing.map((name) => (
            <code
              key={name}
              className="mx-0.5 rounded bg-muted px-1 py-0.5 text-xs"
            >
              {name}
            </code>
          ))}{" "}
          di environment server, lalu deploy ulang. Lihat README bagian
          &quot;Pembayaran&quot;.
        </p>
      )}
      {!encryptionSecret() ? (
        <p className="text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            ENCRYPTION_KEY
          </code>{" "}
          belum diatur, jadi member Premium belum bisa menyimpan Server Key
          Midtrans mereka sendiri.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Notification URL untuk dashboard Midtrans platform
        </span>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
            {webhookUrl}
          </code>
          <CopyButton value={webhookUrl} label="Salin" />
        </div>
        {!hasPublicSiteUrl() ? (
          <span className="text-xs text-muted-foreground">
            Midtrans hanya bisa mengirim ke domain https publik, bukan
            localhost.
          </span>
        ) : null}
      </div>
    </div>
  );
}
