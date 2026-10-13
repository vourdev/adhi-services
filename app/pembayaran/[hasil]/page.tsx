import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Icon, type IconSvgElement } from "@/components/profile/icon";
import { ProfileSurface } from "@/components/profile/profile-view";
import { getDb } from "@/db/client";
import { lookFromProfile } from "@/lib/profile-look";
import { isOrderCode } from "@/lib/security";
import {
  isPaymentOutcome,
  orderSeller,
  type PaymentOutcome,
} from "@/server/order-access";
import { getVisitorLook } from "@/server/profile";

export const metadata: Metadata = {
  title: "Status pembayaran",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ hasil: string }>;
  searchParams: Promise<{ pesanan?: string | string[] }>;
};

const PAGES: Record<
  PaymentOutcome,
  { icon: IconSvgElement; title: string; text: string; help: string }
> = {
  selesai: {
    icon: CheckmarkCircle02Icon,
    title: "Terima kasih",
    text: "Midtrans sedang mengonfirmasi pembayaran Anda. Pesanan diproses otomatis setelah pembayaran diterima.",
    help: "Link halaman pesanan (status dan produk) tersimpan di browser yang dipakai saat checkout. Bukti pembayaran juga dikirim Midtrans ke email Anda. Ada kendala? Hubungi penjual dan sebutkan nomor pesanan.",
  },
  "belum-selesai": {
    icon: Clock01Icon,
    title: "Pembayaran belum selesai",
    text: "Belum ada pembayaran yang diterima untuk pesanan ini.",
    help: "Anda bisa memesan ulang dari halaman penjual. Kalau ternyata sudah membayar, tunggu beberapa menit: pesanan diperbarui otomatis setelah Midtrans menerima pembayaran.",
  },
  gagal: {
    icon: Alert02Icon,
    title: "Pembayaran tidak berhasil",
    text: "Midtrans tidak bisa memproses pembayaran ini.",
    help: "Coba lagi dari halaman penjual, bisa dengan metode pembayaran lain. Kalau saldo Anda terlanjur terpotong, hubungi penjual dan sebutkan nomor pesanan.",
  },
};

/**
 * Where Midtrans' dashboard redirects land when this browser does not hold
 * the order's link (see server/order-access.ts). Shows the outcome, the
 * order number Midtrans passed along, and a way back to the seller; never
 * the order's details, which need the order's secret link.
 */
export default async function PaymentResultPage({
  params,
  searchParams,
}: Props): Promise<ReactNode> {
  const { hasil } = await params;
  if (!isPaymentOutcome(hasil)) notFound();
  const page = PAGES[hasil];
  const { pesanan } = await searchParams;
  const code =
    typeof pesanan === "string" && isOrderCode(pesanan) ? pesanan : null;

  const db = getDb();
  const seller = code ? await orderSeller(db, code) : null;
  const look =
    (seller ? await getVisitorLook(db, seller.profileId) : null) ??
    lookFromProfile({});

  return (
    <ProfileSurface look={look}>
      <main
        id="konten"
        className="mx-auto flex w-full max-w-[34rem] flex-col gap-5 px-4 pt-16 pb-12"
      >
        <header className="flex flex-col items-center gap-2 text-center">
          <Icon
            icon={page.icon}
            className={`size-12 ${hasil === "selesai" ? "text-p-accent-ink" : "text-p-muted"}`}
            strokeWidth={1.5}
          />
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {page.title}
          </h1>
          <p className="text-sm text-pretty text-p-muted">{page.text}</p>
        </header>

        <section className="p-card flex flex-col gap-3 p-5 text-sm leading-relaxed">
          {code ? (
            <p className="flex items-center justify-between gap-4">
              <span className="text-p-muted">Nomor pesanan</span>
              <span className="font-mono font-medium">{code}</span>
            </p>
          ) : null}
          <p className="text-pretty">{page.help}</p>
        </section>

        {seller ? (
          <Link
            href={`/${seller.username}`}
            className="p-btn p-press flex h-12 w-full items-center justify-center bg-p-accent px-6 text-[15px] font-semibold text-p-accent-fg"
          >
            Kembali ke {seller.displayName}
          </Link>
        ) : null}
      </main>
    </ProfileSurface>
  );
}
