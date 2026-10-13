import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Download04Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/profile/icon";
import { ProfileSurface } from "@/components/profile/profile-view";
import { getDb } from "@/db/client";
import { digitalDeliveries, paymentTransactions, profiles } from "@/db/schema";
import { ORDER_STATUS_LABELS } from "@/lib/domain";
import { authSecret } from "@/lib/env";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { buildWhatsAppUrl, isValidWhatsAppNumber } from "@/lib/whatsapp";
import {
  findOrderForBuyer,
  refreshOrderStatus,
  signedDownloadPath,
} from "@/server/checkout";
import { isPaymentOutcome } from "@/server/order-access";
import { gatewayForOrder } from "@/server/payments";
import { getVisitorLook } from "@/server/profile";

export const metadata: Metadata = {
  title: "Status pesanan",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{
    t?: string | string[];
    /** What just happened at Midtrans (set by the redirect routes); only adds a note. */
    hasil?: string | string[];
  }>;
};

/** Notes for a buyer coming back from Midtrans without a finished payment. */
const RETURN_NOTES = {
  "belum-selesai":
    "Pembayaran belum diselesaikan. Lanjutkan sebelum batas waktunya, atau pilih metode pembayaran lain.",
  gagal:
    "Pembayaran tadi tidak bisa diproses. Coba lagi dengan metode yang sama atau metode lain.",
} as const;

const buttonClass =
  "p-press flex h-12 w-full items-center justify-center gap-2 px-6 text-[15px] font-semibold";

/**
 * The buyer's order page, reached from Midtrans' redirects (directly, or
 * through /api/payments/midtrans/*). Access needs the order's secret token
 * (?t=). The status shown here comes from the database, refreshed from the
 * Midtrans Status API while pending; the redirect's own query parameters
 * are never trusted.
 */
export default async function OrderPage({
  params,
  searchParams,
}: Props): Promise<ReactNode> {
  const { code } = await params;
  const { t, hasil } = await searchParams;
  const token = typeof t === "string" ? t : null;
  const db = getDb();

  const found = await findOrderForBuyer(db, code, token);
  if (!found) notFound();
  let { order } = found;
  const { product, delivery } = found;

  const gateway =
    order.status === "pending" ? await gatewayForOrder(db, order) : null;
  if (order.status === "pending" && gateway) {
    try {
      const status = await refreshOrderStatus(db, gateway, order);
      order = { ...order, status };
    } catch (error) {
      console.error("[order] status refresh failed", error);
    }
  }

  const [transaction, profile, look] = await Promise.all([
    db.query.paymentTransactions.findFirst({
      where: eq(paymentTransactions.orderId, order.id),
    }),
    db.query.profiles.findFirst({ where: eq(profiles.id, order.profileId) }),
    getVisitorLook(db, order.profileId),
  ]);
  if (!profile || !look) notFound();

  // After a successful payment, the delivery row exists (created by the webhook or the refresh above).
  const freshDelivery =
    delivery ??
    (order.status === "paid"
      ? ((await db.query.digitalDeliveries.findFirst({
          where: eq(digitalDeliveries.orderId, order.id),
        })) ?? null)
      : null);
  const downloadPath =
    order.status === "paid" && freshDelivery
      ? signedDownloadPath(freshDelivery.id, authSecret())
      : null;
  const contactHref =
    profile.whatsappNumber && isValidWhatsAppNumber(profile.whatsappNumber)
      ? buildWhatsAppUrl(
          profile.whatsappNumber,
          `Halo, saya ingin bertanya tentang pesanan ${order.code} (${product.name}).`
        )
      : null;

  return (
    <ProfileSurface look={look}>
      <main
        id="konten"
        className="mx-auto flex w-full max-w-[34rem] flex-col gap-5 px-4 pt-10 pb-12"
      >
        <StatusHeader status={order.status} />

        {isPaymentOutcome(hasil) &&
        hasil !== "selesai" &&
        order.status !== "paid" &&
        order.status !== "refunded" ? (
          <p
            role="status"
            className="p-card flex gap-3 px-4 py-3.5 text-sm leading-relaxed"
          >
            <Icon
              icon={Alert02Icon}
              className="mt-0.5 size-[18px] shrink-0 text-p-accent-ink"
            />
            {RETURN_NOTES[hasil]}
          </p>
        ) : null}

        <section aria-label="Detail pesanan" className="p-card p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-p-muted">Nomor pesanan</dt>
            <dd className="text-right font-mono font-medium">{order.code}</dd>
            <dt className="text-p-muted">Produk</dt>
            <dd className="text-right font-medium">{product.name}</dd>
            {order.discountCode ? (
              <>
                <dt className="text-p-muted">Kode diskon</dt>
                <dd className="text-right">
                  {order.discountCode} (−{formatRupiah(order.discountAmount)})
                </dd>
              </>
            ) : null}
            <dt className="text-p-muted">Total</dt>
            <dd className="text-right font-semibold">
              {formatRupiah(order.amount)}
            </dd>
            <dt className="text-p-muted">Status</dt>
            <dd className="text-right">{ORDER_STATUS_LABELS[order.status]}</dd>
            <dt className="text-p-muted">Dibuat</dt>
            <dd className="text-right">{formatDateTime(order.createdAt)}</dd>
            {order.paidAt ? (
              <>
                <dt className="text-p-muted">Dibayar</dt>
                <dd className="text-right">{formatDateTime(order.paidAt)}</dd>
              </>
            ) : null}
          </dl>
        </section>

        {order.status === "paid" ? (
          downloadPath ? (
            <div className="flex flex-col gap-2">
              <a
                href={downloadPath}
                rel="nofollow"
                className={`${buttonClass} p-btn bg-p-accent text-p-accent-fg`}
              >
                <Icon icon={Download04Icon} className="size-5" />
                {product.deliveryType === "link"
                  ? "Buka produk"
                  : "Unduh produk"}
              </a>
              <p className="text-center text-xs text-p-muted">
                Simpan halaman ini. Link unduhan diperbarui setiap kali halaman
                dibuka
                {freshDelivery
                  ? ` (sisa ${Math.max(0, freshDelivery.maxDownloads - freshDelivery.downloadCount)} kali unduh)`
                  : ""}
                .
              </p>
            </div>
          ) : (
            <p className="p-card px-4 py-3 text-sm text-p-muted">
              Pembayaran sudah diterima. Penjual akan menghubungi Anda untuk
              langkah berikutnya.
            </p>
          )
        ) : null}

        {order.status === "pending" ? (
          <div className="flex flex-col gap-2">
            {transaction?.redirectUrl ? (
              <a
                href={transaction.redirectUrl}
                className={`${buttonClass} p-btn bg-p-accent text-p-accent-fg`}
              >
                Lanjutkan pembayaran
              </a>
            ) : null}
            <Link
              href={`/pesanan/${encodeURIComponent(order.code)}?t=${encodeURIComponent(token ?? "")}`}
              className={`${buttonClass} p-tile rounded-[var(--p-r-btn)]`}
            >
              Cek status lagi
            </Link>
          </div>
        ) : null}

        {order.status === "failed" ||
        order.status === "expired" ||
        order.status === "cancelled" ? (
          <Link
            href={`/${profile.username}/${product.slug}`}
            className={`${buttonClass} p-btn bg-p-accent text-p-accent-fg`}
          >
            Pesan ulang
          </Link>
        ) : null}

        {contactHref ? (
          <a
            href={contactHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm font-medium text-p-muted hover:text-p-fg"
          >
            <Icon icon={WhatsappIcon} className="size-[18px]" />
            Hubungi penjual
          </a>
        ) : null}
      </main>
    </ProfileSurface>
  );
}

function StatusHeader({
  status,
}: {
  status: keyof typeof ORDER_STATUS_LABELS;
}): ReactNode {
  if (status === "paid") {
    return (
      <header className="flex flex-col items-center gap-2 text-center">
        <Icon
          icon={CheckmarkCircle02Icon}
          className="size-12 text-p-accent-ink"
          strokeWidth={1.5}
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Pembayaran berhasil
        </h1>
        <p className="text-sm text-p-muted">
          Terima kasih. Pembayaran Anda sudah terverifikasi.
        </p>
      </header>
    );
  }
  if (status === "pending") {
    return (
      <header className="flex flex-col items-center gap-2 text-center">
        <Icon
          icon={Clock01Icon}
          className="size-12 text-p-muted"
          strokeWidth={1.5}
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Menunggu pembayaran
        </h1>
        <p className="text-sm text-p-muted">
          Status berubah otomatis setelah pembayaran diterima.
        </p>
      </header>
    );
  }
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <Icon
        icon={Alert02Icon}
        className="size-12 text-p-muted"
        strokeWidth={1.5}
      />
      <h1 className="text-2xl font-semibold tracking-tight">
        {ORDER_STATUS_LABELS[status]}
      </h1>
      <p className="text-sm text-p-muted">
        {status === "refunded"
          ? "Dana pesanan ini sudah dikembalikan."
          : "Pesanan ini tidak dibayar. Anda bisa memesan ulang."}
      </p>
    </header>
  );
}
