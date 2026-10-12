import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  describeRange,
  parseRange,
  previousRange,
  rangeToSearchParams,
} from "@/lib/analytics/range";
import { hasPublicSiteUrl, isProduction, siteUrl } from "@/lib/env";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";
import { adminContext } from "@/server/admin";
import {
  getOverview,
  getRecentActivity,
  getTopLinks,
  getTrafficSeries,
  getTrafficSources,
} from "@/server/analytics/queries";

import { CardsRow } from "../_components/analytics/cards-row";
import {
  NoData,
  RecentActivityCard,
  SourcesCard,
  TopLinksCard,
} from "../_components/analytics/cards";
import { DateRangeFilter } from "../_components/analytics/date-range-filter";
import { KpiStrip } from "../_components/analytics/kpi-strip";
import { CTR_HINT, UNIQUE_VISITOR_HINT } from "../_components/analytics/labels";
import {
  TrafficChart,
  TrafficTable,
} from "../_components/analytics/traffic-chart";
import { CopyButton } from "../_components/copy-button";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Overview" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OverviewPage({
  searchParams,
}: Props): Promise<ReactNode> {
  const { db, owner, profileId } = await adminContext();
  const range = parseRange(await searchParams);
  const [overview, series, topLinks, traffic, activity] = await Promise.all([
    getOverview(db, profileId, range),
    getTrafficSeries(db, profileId, range),
    getTopLinks(db, profileId, range),
    getTrafficSources(db, profileId, range),
    getRecentActivity(db, profileId, 10),
  ]);
  const previous = previousRange(range);
  const comparison = `vs ${describeRange(previous).toLowerCase()} sebelumnya`;
  const publicUrl = `${siteUrl()}/${owner.profile.username}`;
  const totalViews = overview.profileViews.value ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Halo, ${owner.profile.displayName.split(" ")[0]}`}
        description={`Performa profil publik Anda · ${describeRange(range)}`}
        actions={<DateRangeFilter range={range} />}
      />

      <SetupAlerts whatsappNumber={owner.profile.whatsappNumber} />

      <KpiStrip
        comparisonLabel={
          range.preset === "custom" ? "vs periode sebelumnya" : comparison
        }
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

      <CardsRow>
        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Traffic dari waktu ke waktu</CardTitle>
            <CardDescription>
              Tayangan profil dan pengunjung unik per hari (WIB).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalViews === 0 ? (
              <NoData title="Belum ada kunjungan di periode ini">
                Bagikan link profil Anda:{" "}
                <span className="font-medium text-foreground">{publicUrl}</span>
                <span className="mt-3 block">
                  <CopyButton value={publicUrl} label="Salin link profil" />
                </span>
              </NoData>
            ) : series.length < 2 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {totalViews} tayangan hari ini. Pilih rentang lebih dari satu
                hari untuk melihat tren.
              </p>
            ) : (
              <>
                <TrafficChart data={series} />
                <TrafficTable data={series} />
              </>
            )}
          </CardContent>
        </Card>
        <div className="xl:col-span-4">
          <SourcesCard sources={traffic.sources} />
        </div>
      </CardsRow>

      <CardsRow>
        <div className="xl:col-span-7">
          <TopLinksCard
            links={topLinks}
            rangeQuery={rangeToSearchParams(range)}
            limit={6}
          />
        </div>
        <div className="xl:col-span-5">
          <RecentActivityCard rows={activity} />
        </div>
      </CardsRow>
    </div>
  );
}

function SetupAlerts({
  whatsappNumber,
}: {
  whatsappNumber: string | null;
}): ReactNode {
  const missing: ReactNode[] = [];
  if (!whatsappNumber || !isValidWhatsAppNumber(whatsappNumber)) {
    missing.push(
      <li key="wa">
        Nomor WhatsApp belum diatur. Produk dengan checkout WhatsApp belum bisa
        dipesan.{" "}
        <Link
          href="/admin/settings"
          className="font-medium underline underline-offset-2"
        >
          Atur di Settings
        </Link>
      </li>
    );
  }
  if (isProduction && !hasPublicSiteUrl()) {
    missing.push(
      <li key="url">
        SITE_URL belum berisi domain https. Halaman tidak diindeks mesin pencari
        dan checkout langsung nonaktif.
      </li>
    );
  }
  if (missing.length === 0) return null;
  return (
    <Alert>
      <TriangleAlert />
      <AlertTitle>Perlu diatur</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">{missing}</ul>
      </AlertDescription>
    </Alert>
  );
}
