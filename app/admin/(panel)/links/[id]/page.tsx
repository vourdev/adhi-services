import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { describeRange, parseRange } from "@/lib/analytics/range";
import { TRAFFIC_SOURCE_LABELS } from "@/lib/domain";
import { formatPercent } from "@/lib/format";
import { adminContext } from "@/server/admin";
import { getLinkAnalytics } from "@/server/analytics/queries";

import { BarList } from "../../../_components/analytics/bar-list";
import { CardsRow } from "../../../_components/analytics/cards-row";
import { NoData } from "../../../_components/analytics/cards";
import { DailyBarChart } from "../../../_components/analytics/daily-bar-chart";
import { DateRangeFilter } from "../../../_components/analytics/date-range-filter";
import { KpiStrip } from "../../../_components/analytics/kpi-strip";
import { CTR_HINT } from "../../../_components/analytics/labels";
import { PageHeader } from "../../../_components/page-header";

export const metadata: Metadata = { title: "Statistik link" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LinkAnalyticsPage({
  params,
  searchParams,
}: Props): Promise<ReactNode> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db, profileId } = await adminContext();
  const range = parseRange(await searchParams);
  const data = await getLinkAnalytics(db, profileId, id, range);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/links">
          <ArrowLeft />
          Semua link
        </Link>
      </Button>
      <PageHeader
        title={data.link.title ?? "Link"}
        description={`${data.link.kind === "whatsapp" ? "Chat WhatsApp" : (data.link.url ?? "")} · ${describeRange(range)}`}
        actions={
          <>
            {data.link.url ? (
              <Button variant="outline" asChild>
                <a
                  href={data.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink />
                  Buka tujuan
                </a>
              </Button>
            ) : null}
            <DateRangeFilter range={range} />
          </>
        }
      />
      <KpiStrip
        items={[
          { label: "Klik", value: data.clicks, change: null },
          {
            label: "CTR link",
            value: data.ctr,
            change: null,
            unit: "percent",
            hint: CTR_HINT,
          },
          {
            label: "Porsi dari semua klik",
            value: data.share,
            change: null,
            unit: "percent",
            formatted: formatPercent(data.share, 0),
          },
        ]}
      />
      <CardsRow>
        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Klik per hari</CardTitle>
            <CardDescription>
              Dari {data.profileViews} tayangan profil di periode yang sama.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.clicks === 0 ? (
              <NoData title="Belum ada klik di periode ini" />
            ) : (
              <DailyBarChart
                data={data.series.map((point) => ({
                  date: point.date,
                  value: point.clicks,
                }))}
                label="Klik"
              />
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Klik menurut sumber</CardTitle>
            <CardDescription>
              Sumber kunjungan yang menghasilkan klik ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.sources.length === 0 ? (
              <NoData title="Belum ada data" />
            ) : (
              <BarList
                valueLabel="Klik per sumber"
                items={data.sources.map((row) => ({
                  key: row.source,
                  label: TRAFFIC_SOURCE_LABELS[row.source],
                  value: row.clicks,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </CardsRow>
    </div>
  );
}
