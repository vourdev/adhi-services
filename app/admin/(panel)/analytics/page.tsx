import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  describeRange,
  parseRange,
  rangeToSearchParams,
} from "@/lib/analytics/range";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { adminContext } from "@/server/admin";
import {
  getOverview,
  getProductAnalytics,
  getTopLinks,
  getTrafficSeries,
  getTrafficSources,
} from "@/server/analytics/queries";

import { BarList } from "../../_components/analytics/bar-list";
import { CardsRow } from "../../_components/analytics/cards-row";
import {
  DevicesCard,
  NoData,
  SourcesCard,
  TopLinksCard,
} from "../../_components/analytics/cards";
import { DateRangeFilter } from "../../_components/analytics/date-range-filter";
import { KpiStrip } from "../../_components/analytics/kpi-strip";
import {
  CTR_HINT,
  UNIQUE_VISITOR_HINT,
} from "../../_components/analytics/labels";
import {
  TrafficChart,
  TrafficTable,
} from "../../_components/analytics/traffic-chart";
import { PageHeader } from "../../_components/page-header";

export const metadata: Metadata = { title: "Analytics" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AnalyticsPage({
  searchParams,
}: Props): Promise<ReactNode> {
  const { db, profileId } = await adminContext();
  const params = await searchParams;
  const range = parseRange(params);
  const tab =
    typeof params.tab === "string" &&
    ["traffic", "links", "products"].includes(params.tab)
      ? params.tab
      : "traffic";

  const [overview, series, traffic, products] = await Promise.all([
    getOverview(db, profileId, range),
    getTrafficSeries(db, profileId, range),
    getTrafficSources(db, profileId, range),
    getProductAnalytics(db, profileId, range),
  ]);
  const topLinks = await getTopLinks(db, profileId, range, {
    profileViews: overview.profileViews.value ?? 0,
  });
  const rangeQuery = rangeToSearchParams(range);
  const { metrics } = products;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Analytics"
        description={describeRange(range)}
        actions={<DateRangeFilter range={range} extraParams={{ tab }} />}
      />

      <Tabs defaultValue={tab} className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="products">Produk</TabsTrigger>
        </TabsList>

        <TabsContent value="traffic" className="flex flex-col gap-4">
          <KpiStrip
            comparisonLabel="vs periode sebelumnya"
            items={[
              {
                label: "Tayangan profil",
                value: overview.profileViews.value,
                change: overview.profileViews.change,
              },
              {
                label: "Pengunjung unik",
                value: overview.uniqueVisitors.value,
                change: overview.uniqueVisitors.change,
                hint: UNIQUE_VISITOR_HINT,
              },
              {
                label: "Sesi",
                value: overview.sessions.value,
                change: overview.sessions.change,
                hint: "Kunjungan yang dipisahkan jeda 30 menit tanpa aktivitas.",
              },
              {
                label: "Klik link",
                value: overview.linkClicks.value,
                change: overview.linkClicks.change,
              },
              {
                label: "CTR keseluruhan",
                value: overview.ctr.value,
                change: overview.ctr.change,
                unit: "percent",
                hint: CTR_HINT,
              },
            ]}
          />
          <Card>
            <CardHeader>
              <CardTitle>Traffic dari waktu ke waktu</CardTitle>
              <CardDescription>Per hari, WIB.</CardDescription>
            </CardHeader>
            <CardContent>
              {(overview.profileViews.value ?? 0) === 0 ? (
                <NoData title="Belum ada kunjungan di periode ini" />
              ) : series.length < 2 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Pilih rentang lebih dari satu hari untuk melihat tren.
                </p>
              ) : (
                <>
                  <TrafficChart data={series} />
                  <TrafficTable data={series} />
                </>
              )}
            </CardContent>
          </Card>
          <CardsRow>
            <div className="xl:col-span-5">
              <SourcesCard
                sources={traffic.sources}
                referrers={traffic.referrers}
              />
            </div>
            <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle>Kampanye (utm_campaign)</CardTitle>
                <CardDescription>
                  Tambahkan ?utm_source=instagram&amp;utm_campaign=nama ke link
                  profil yang Anda bagikan untuk melacak kampanye.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {traffic.campaigns.length === 0 ? (
                  <NoData title="Belum ada kunjungan dengan UTM" />
                ) : (
                  <BarList
                    valueLabel="Tayangan per kampanye"
                    items={traffic.campaigns.map((row) => ({
                      key: `${row.campaign}-${row.source ?? ""}`,
                      label: `${row.campaign}${row.source ? ` · ${row.source}` : ""}`,
                      value: row.views,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
            <div className="xl:col-span-3">
              <DevicesCard devices={traffic.devices} />
            </div>
          </CardsRow>
          <MetricDefinitions />
        </TabsContent>

        <TabsContent value="links" className="flex flex-col gap-4">
          <TopLinksCard links={topLinks} rangeQuery={rangeQuery} />
        </TabsContent>

        <TabsContent value="products" className="flex flex-col gap-4">
          <KpiStrip
            items={[
              {
                label: "Tayangan produk",
                value: metrics.productViews,
                change: null,
              },
              {
                label: "CTR produk",
                value: metrics.productCtr,
                change: null,
                unit: "percent",
                hint: "Klik kartu produk di profil ÷ tayangan profil × 100.",
              },
              {
                label: "Klik pesan via WhatsApp",
                value: metrics.whatsappClicks,
                change: null,
                hint: "Pengunjung yang membuka chat WhatsApp dari halaman produk. Ini bukan penjualan: transaksinya terjadi di luar sistem.",
              },
              {
                label: "Checkout dimulai",
                value: metrics.checkoutStarts,
                change: null,
                hint: "Pengunjung yang membuka halaman checkout langsung.",
              },
            ]}
          />
          <KpiStrip
            items={[
              {
                label: "Pembayaran dibuat",
                value: metrics.paymentsInitiated,
                change: null,
              },
              {
                label: "Transaksi berhasil",
                value: metrics.paidOrders,
                change: null,
                hint: "Pesanan yang lunas menurut verifikasi server (webhook Midtrans + Status API).",
              },
              {
                label: "Pendapatan kotor",
                value: metrics.revenue,
                change: null,
                formatted: formatRupiah(metrics.revenue),
                hint: "Jumlah nominal pesanan lunas di periode ini, sebelum potongan biaya Midtrans.",
              },
              {
                label: "Konversi",
                value: metrics.conversionRate,
                change: null,
                unit: "percent",
                hint: "Transaksi berhasil ÷ tayangan produk × 100.",
              },
            ]}
          />
          <Card>
            <CardHeader>
              <CardTitle>Per produk</CardTitle>
              <CardDescription>
                Klik WhatsApp dihitung terpisah dari transaksi yang
                terverifikasi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {products.rows.length === 0 ? (
                <NoData title="Belum ada produk">
                  <Link href="/admin/products/new" className="underline">
                    Buat produk pertama
                  </Link>
                </NoData>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-sm tabular-nums">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th scope="col" className="pb-2 font-normal">
                          Produk
                        </th>
                        <th scope="col" className="pb-2 text-right font-normal">
                          Tayangan
                        </th>
                        <th scope="col" className="pb-2 text-right font-normal">
                          Klik kartu
                        </th>
                        <th scope="col" className="pb-2 text-right font-normal">
                          Klik WhatsApp
                        </th>
                        <th scope="col" className="pb-2 text-right font-normal">
                          Checkout
                        </th>
                        <th scope="col" className="pb-2 text-right font-normal">
                          Lunas
                        </th>
                        <th scope="col" className="pb-2 text-right font-normal">
                          Pendapatan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.rows.map((row) => (
                        <tr key={row.productId} className="border-t">
                          <td className="py-2 pr-3">
                            <Link
                              href={`/admin/products/${row.productId}`}
                              className="font-medium hover:underline"
                            >
                              {row.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {row.checkoutMethod === "whatsapp"
                                ? "WhatsApp"
                                : "Checkout langsung"}
                            </div>
                          </td>
                          <td className="py-2 text-right">
                            {formatNumber(row.views)}
                          </td>
                          <td className="py-2 text-right">
                            {formatNumber(row.clicks)}
                          </td>
                          <td className="py-2 text-right">
                            {row.checkoutMethod === "whatsapp"
                              ? formatNumber(row.whatsappClicks)
                              : "-"}
                          </td>
                          <td className="py-2 text-right">
                            {row.checkoutMethod === "direct"
                              ? formatNumber(row.checkoutStarts)
                              : "-"}
                          </td>
                          <td className="py-2 text-right">
                            {row.checkoutMethod === "direct"
                              ? formatNumber(row.paidOrders)
                              : "-"}
                          </td>
                          <td className="py-2 text-right">
                            {row.checkoutMethod === "direct"
                              ? formatRupiah(row.revenue)
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Produk terlaris</CardTitle>
              <CardDescription>
                Berdasarkan jumlah transaksi lunas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {products.bestSellers.length === 0 ? (
                <NoData title="Belum ada transaksi lunas di periode ini" />
              ) : (
                <BarList
                  valueLabel="Transaksi lunas per produk"
                  items={products.bestSellers.map((row) => ({
                    key: row.productId,
                    label: row.name,
                    value: row.paidOrders,
                    detail: formatRupiah(row.revenue),
                  }))}
                />
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Pembayaran gagal/kedaluwarsa di periode ini:{" "}
            {formatNumber(metrics.paymentsFailed)}. CTR produk{" "}
            {formatPercent(metrics.productCtr)}.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricDefinitions(): ReactNode {
  return (
    <details className="rounded-xl border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">Definisi metrik</summary>
      <dl className="mt-3 grid gap-3 text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Tayangan profil</dt>
          <dd>
            Halaman profil dibuka di browser. Membuka ulang halaman yang sama
            dalam 30 menit dihitung sekali. Bot, link preview, dan kunjungan
            pemilik profil (saat login) tidak dihitung. Aturan ini berlaku
            sejak 15 Okt 2026; data sebelumnya tidak diubah.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Pengunjung unik</dt>
          <dd>{UNIQUE_VISITOR_HINT}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Sesi</dt>
          <dd>
            Rangkaian kunjungan dari browser yang sama tanpa jeda lebih dari 30
            menit.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">CTR</dt>
          <dd>{CTR_HINT}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Sumber traffic</dt>
          <dd>
            UTM lebih dulu, lalu domain referrer. Tanpa keduanya masuk
            &quot;Langsung / tidak diketahui&quot;, termasuk aplikasi yang
            menyembunyikan referrer.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Perbandingan</dt>
          <dd>
            Dibandingkan dengan periode sepanjang yang sama tepat sebelumnya.
            Untuk CTR, selisihnya dalam poin persentase.
          </dd>
        </div>
      </dl>
    </details>
  );
}
