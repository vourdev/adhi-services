import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/profile/icon";
import { getDb } from "@/db/client";
import { orderItems, paymentTransactions } from "@/db/schema";
import type { OrderStatus } from "@/lib/domain";
import { authSecret, siteUrl } from "@/lib/env";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { findOrderForBuyer } from "@/server/checkout";
import { orderAccessQuery } from "@/server/order-access";
import { getPlatformSettings } from "@/server/platform-settings";

import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string | string[]; k?: string | string[] }>;
};

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  paid: { label: "Lunas", className: "bg-[#e7f6ee] text-[#0f7a43]" },
  refunded: { label: "Dikembalikan", className: "bg-[#eef0f3] text-[#5b6474]" },
  pending: {
    label: "Menunggu pembayaran",
    className: "bg-[#fff4e0] text-[#9c4508]",
  },
  failed: { label: "Tidak dibayar", className: "bg-[#fdecec] text-[#b42318]" },
  expired: { label: "Tidak dibayar", className: "bg-[#fdecec] text-[#b42318]" },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-[#fdecec] text-[#b42318]",
  },
};

/**
 * A printable invoice for one order, opened with the same secret link as
 * the order page (?t= or the email's ?k=). Plain paper styling so it
 * prints or saves as PDF cleanly.
 */
export default async function InvoicePage({
  params,
  searchParams,
}: Props): Promise<ReactNode> {
  const { code } = await params;
  const { t, k } = await searchParams;
  const token = typeof t === "string" ? t : null;
  const key = typeof k === "string" ? k : null;
  const db = getDb();
  const found = await findOrderForBuyer(db, code, token, {
    key,
    secret: authSecret(),
  });
  if (!found) notFound();
  const { order, product, profile } = found;
  const [item, transaction, platform] = await Promise.all([
    db.query.orderItems.findFirst({ where: eq(orderItems.orderId, order.id) }),
    db.query.paymentTransactions.findFirst({
      where: eq(paymentTransactions.orderId, order.id),
    }),
    getPlatformSettings(db),
  ]);
  const listAmount = item?.listAmount ?? order.amount + order.discountAmount;
  const method = paymentMethodLabel(transaction?.paymentType);
  const status = STATUS[order.status];
  const host = new URL(siteUrl()).host;

  return (
    <div className="min-h-dvh bg-[#f1f3f6] px-4 py-8 text-[#111827] print:bg-white print:p-0">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={`/pesanan/${encodeURIComponent(order.code)}?${orderAccessQuery({ token, key })}`}
            className="flex items-center gap-2 py-2 text-sm font-semibold text-[#5b6474] hover:text-[#111827]"
          >
            <Icon icon={ArrowLeft01Icon} className="size-[18px]" />
            Kembali ke pesanan
          </Link>
          <PrintButton />
        </div>

        <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgb(17_24_39/0.05)] ring-1 ring-[#e3e6eb] sm:p-10 print:rounded-none print:p-0 print:shadow-none print:ring-0">
          <header className="flex flex-col justify-between gap-6 sm:flex-row">
            <div>
              <p className="text-xl font-bold tracking-tight">
                {profile.displayName}
              </p>
              <p className="mt-1 text-sm text-[#5b6474]">
                {host}/{profile.username}
              </p>
            </div>
            <div className="sm:text-right">
              <h1 className="text-2xl font-bold tracking-tight">Invoice</h1>
              <p className="mt-1 font-mono text-sm">{order.code}</p>
              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold tracking-wide uppercase ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          </header>

          <section className="mt-8 grid gap-6 border-t border-[#e3e6eb] pt-6 text-sm sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold tracking-wide text-[#5b6474] uppercase">
                Ditagihkan kepada
              </h2>
              <p className="mt-2 font-semibold">{order.buyerName}</p>
              <p className="text-[#5b6474]">{order.buyerEmail}</p>
              {order.buyerPhone ? (
                <p className="text-[#5b6474]">{order.buyerPhone}</p>
              ) : null}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 sm:justify-self-end">
              <dt className="text-[#5b6474]">Tanggal</dt>
              <dd className="sm:text-right">
                {formatDateTime(order.createdAt)}
              </dd>
              {order.paidAt ? (
                <>
                  <dt className="text-[#5b6474]">Dibayar</dt>
                  <dd className="sm:text-right">
                    {formatDateTime(order.paidAt)}
                  </dd>
                </>
              ) : null}
              {method ? (
                <>
                  <dt className="text-[#5b6474]">Metode</dt>
                  <dd className="sm:text-right">{method}</dd>
                </>
              ) : null}
            </dl>
          </section>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-[#e3e6eb] text-left text-xs tracking-wide text-[#5b6474] uppercase">
                <th className="pb-2 font-semibold">Produk</th>
                <th className="pb-2 text-right font-semibold">Jumlah</th>
                <th className="pb-2 text-right font-semibold">Harga</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#e3e6eb]">
                <td className="py-3 pr-4 font-medium">
                  {item?.productName ?? product.name}
                </td>
                <td className="py-3 text-right tabular-nums">1</td>
                <td className="py-3 text-right tabular-nums">
                  {formatRupiah(listAmount)}
                </td>
              </tr>
            </tbody>
          </table>

          <dl className="mt-4 ml-auto flex max-w-xs flex-col gap-2 text-sm tabular-nums">
            <div className="flex justify-between gap-6">
              <dt className="text-[#5b6474]">Subtotal</dt>
              <dd>{formatRupiah(listAmount)}</dd>
            </div>
            {order.discountCode ? (
              <div className="flex justify-between gap-6">
                <dt className="text-[#5b6474]">
                  Diskon ({order.discountCode})
                </dt>
                <dd>−{formatRupiah(order.discountAmount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-6 border-t border-[#e3e6eb] pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatRupiah(order.amount)}</dd>
            </div>
          </dl>

          <footer className="mt-10 border-t border-[#e3e6eb] pt-4 text-xs leading-relaxed text-[#5b6474]">
            Invoice ini dibuat otomatis oleh {platform.brandName} untuk{" "}
            {profile.displayName}. Simpan sebagai bukti pembelian.
          </footer>
        </article>
      </div>
    </div>
  );
}
