import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { TRAFFIC_SOURCE_LABELS } from "@/lib/domain";
import { formatNumber, formatPercent, formatRelative } from "@/lib/format";
import type {
  ActivityRow,
  DeviceRow,
  ReferrerRow,
  SourceRow,
  TopLink,
} from "@/server/analytics/queries";

import { BarList } from "./bar-list";
import { DEVICE_LABELS, EVENT_LABELS } from "./labels";

export function NoData({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <Empty className="border border-dashed py-8">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        {children ? (
          <EmptyDescription className="text-xs">{children}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  );
}

export function TopLinksCard({
  links,
  rangeQuery,
  limit,
}: {
  links: TopLink[];
  rangeQuery: string;
  limit?: number;
}): ReactNode {
  const shown = limit ? links.slice(0, limit) : links;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Link paling banyak diklik</CardTitle>
        <CardDescription>
          Klik, porsi dari semua klik, dan CTR terhadap tayangan profil.
        </CardDescription>
        {limit ? (
          <CardAction>
            <Link
              href={`/admin/analytics?${rangeQuery}`}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Detail <ArrowRight className="size-3.5" />
            </Link>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <NoData title="Belum ada klik di periode ini">
            Klik pada link profil akan muncul di sini.
          </NoData>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 font-normal">
                    Link
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Klik
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Porsi
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    CTR
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {shown.map((link) => (
                  <tr key={link.linkId ?? "deleted"} className="border-t">
                    <td className="py-2 pr-3">
                      {link.linkId ? (
                        <Link
                          href={`/admin/links/${link.linkId}?${rangeQuery}`}
                          className="font-medium hover:underline"
                        >
                          {link.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground italic">
                          {link.title}
                        </span>
                      )}
                      {link.url ? (
                        <div className="max-w-[18rem] truncate text-xs text-muted-foreground">
                          {link.url}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatNumber(link.clicks)}
                    </td>
                    <td className="py-2 text-right">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:inline-block"
                        >
                          <span
                            className="block h-full rounded-full bg-chart-1"
                            style={{ width: `${link.share ?? 0}%` }}
                          />
                        </span>
                        {formatPercent(link.share, 0)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {formatPercent(link.ctr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SourcesCard({
  sources,
  referrers,
}: {
  sources: SourceRow[];
  referrers?: ReferrerRow[];
}): ReactNode {
  const total = sources.reduce((sum, row) => sum + row.views, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Sumber traffic</CardTitle>
        <CardDescription>
          Dari referrer dan parameter UTM. Tanpa keduanya dihitung langsung /
          tidak diketahui.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {total === 0 ? (
          <NoData title="Belum ada kunjungan" />
        ) : (
          <BarList
            valueLabel="Tayangan per sumber"
            total={total}
            items={sources.map((row) => ({
              key: row.source,
              label: TRAFFIC_SOURCE_LABELS[row.source],
              value: row.views,
            }))}
          />
        )}
        {referrers && referrers.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Situs asal teratas
            </h3>
            <BarList
              valueLabel="Tayangan per situs asal"
              items={referrers.map((row) => ({
                key: row.host,
                label: row.host,
                value: row.views,
              }))}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DevicesCard({ devices }: { devices: DeviceRow[] }): ReactNode {
  const total = devices.reduce((sum, row) => sum + row.views, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Perangkat</CardTitle>
        <CardDescription>
          Jenis perangkat dari user agent. User agent lengkap tidak disimpan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <NoData title="Belum ada kunjungan" />
        ) : (
          <BarList
            valueLabel="Tayangan per perangkat"
            items={devices.map((row) => ({
              key: row.device,
              label: DEVICE_LABELS[row.device],
              value: row.views,
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function RecentActivityCard({
  rows,
}: {
  rows: ActivityRow[];
}): ReactNode {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Aktivitas terbaru</CardTitle>
        <CardDescription>Tanpa identitas pengunjung.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <NoData title="Belum ada aktivitas" />
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium">{EVENT_LABELS[row.eventType]}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      row.label,
                      row.source ? TRAFFIC_SOURCE_LABELS[row.source] : null,
                      row.device ? DEVICE_LABELS[row.device] : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={new Date(row.occurredAt).toISOString()}
                >
                  {formatRelative(row.occurredAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
