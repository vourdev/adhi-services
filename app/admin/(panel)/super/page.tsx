import {
  Crown,
  ExternalLink,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { superAdminContext } from "@/server/admin";
import { getPlatformOverview, getPlatformSettings } from "@/server/super-admin";

import { PageHeader } from "../../_components/page-header";

export const metadata: Metadata = { title: "Super Admin Master Control" };

export default async function SuperAdminOverviewPage(): Promise<ReactNode> {
  const { db, owner } = await superAdminContext();
  const [stats, settings] = await Promise.all([
    getPlatformOverview(db),
    getPlatformSettings(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Master Control Super Admin"
        description={`Pusat kendali ekosistem SaaS · Platform ${settings.brandName}`}
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/admin/super/members">
                <UserPlus className="mr-1.5 size-4" />
                Kelola & Tambah Member
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pengguna
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalProfiles} profil aktif
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Member Premium
            </CardTitle>
            <Crown className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.totalPremiumUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalUsers > 0
                ? `${Math.round((stats.totalPremiumUsers / stats.totalUsers) * 100)}% dari total pengguna`
                : "Belum ada member"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Produk Digital
            </CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              Katalog seluruh kreator
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Transaksi
            </CardTitle>
            <Receipt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              Pesanan di seluruh platform
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aksi Super Admin</CardTitle>
            <CardDescription>
              Akses cepat pengelolaan pengguna dan konfigurasi SaaS
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              href="/admin/super/members"
              className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Tambah Member Premium
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Buatkan akun kreator baru atau upgrade member langsung
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium whitespace-nowrap text-primary">
                Buka →
              </span>
            </Link>

            <Link
              href="/admin/super/settings"
              className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Settings className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Kustomisasi Brand Platform
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ubah nama platform, tagline, dan watermark publik
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium whitespace-nowrap text-primary">
                Buka →
              </span>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Akun Super Admin</CardTitle>
            <CardDescription>
              Detail akun utama pemegang kontrol penuh
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Nama Super Admin:</span>
              <span className="font-semibold">{owner.user.name}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-mono text-xs">{owner.user.email}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Profil Utama:</span>
              <Link
                href={`/${owner.profile.username}`}
                target="_blank"
                className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4"
              >
                @{owner.profile.username}
                <ExternalLink className="size-3" />
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status Hak Akses:</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <ShieldCheck className="size-3.5" />
                Super Admin Aktif
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
