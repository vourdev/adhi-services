"use client";

import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type TrafficPoint = { date: string; views: number; visitors: number };

const config = {
  views: { label: "Tayangan profil", color: "var(--chart-1)" },
  visitors: { label: "Pengunjung unik", color: "var(--chart-2)" },
} satisfies ChartConfig;

const shortDate = (key: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00Z`));
const longDate = (key: string) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00Z`));

/** Page views and unique visitors per day (WIB). Two series on one count axis. */
export function TrafficChart({ data }: { data: TrafficPoint[] }): ReactNode {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 12, top: 8 }}
      >
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={shortDate}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) =>
                longDate(String(payload?.[0]?.payload?.date ?? ""))
              }
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="views"
          type="monotone"
          stroke="var(--color-views)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="visitors"
          type="monotone"
          stroke="var(--color-visitors)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function TrafficTable({ data }: { data: TrafficPoint[] }): ReactNode {
  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
        Lihat sebagai tabel
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">
            Tayangan profil dan pengunjung unik per hari
          </caption>
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Tanggal
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Tayangan
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Pengunjung unik
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.date} className="border-t">
                <td className="px-3 py-1.5">{shortDate(point.date)}</td>
                <td className="px-3 py-1.5 text-right">{point.views}</td>
                <td className="px-3 py-1.5 text-right">{point.visitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
