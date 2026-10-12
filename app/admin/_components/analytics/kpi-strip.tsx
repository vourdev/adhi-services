import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber, formatPercent } from "@/lib/format";

export type Kpi = {
  label: string;
  value: number | null;
  /** Percent change, or percentage points when `unit` is "percent". */
  change: number | null;
  unit?: "count" | "percent" | "currency";
  hint?: string;
  formatted?: string;
};

function ChangeBadge({
  change,
  unit,
}: {
  change: number | null;
  unit: Kpi["unit"];
}): ReactNode {
  if (change === null || !Number.isFinite(change)) {
    return (
      <Badge variant="secondary" className="font-normal">
        <Minus aria-hidden />
        <span>tidak ada pembanding</span>
      </Badge>
    );
  }
  const rounded = Math.round(change * 10) / 10;
  const up = rounded > 0;
  const flat = rounded === 0;
  const text =
    unit === "percent"
      ? `${up ? "+" : ""}${rounded.toLocaleString("id-ID")} poin`
      : `${up ? "+" : ""}${rounded.toLocaleString("id-ID")}%`;
  return (
    <Badge
      className={
        flat
          ? "bg-secondary text-secondary-foreground"
          : up
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-destructive"
      }
    >
      {flat ? (
        <Minus aria-hidden />
      ) : up ? (
        <ArrowUpRight aria-hidden />
      ) : (
        <ArrowDownRight aria-hidden />
      )}
      <span>
        <span className="sr-only">
          {up ? "naik" : flat ? "tetap" : "turun"}{" "}
        </span>
        {text}
      </span>
    </Badge>
  );
}

/** KPI row in the reference dashboard's joined-card style. */
export function KpiStrip({
  items,
  comparisonLabel,
}: {
  items: Kpi[];
  comparisonLabel?: string;
}): ReactNode {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div
        className={`grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 sm:grid-cols-2 sm:divide-y-0 ${
          items.length >= 5
            ? "xl:grid-cols-5"
            : items.length === 4
              ? "xl:grid-cols-4"
              : "xl:grid-cols-3"
        } xl:divide-x xl:[&>*]:border-r-0 sm:[&>*:nth-child(odd)]:border-r`}
      >
        {items.map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {item.label}
              </CardTitle>
              {item.hint ? (
                <CardAction>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="rounded-sm text-muted-foreground"
                        aria-label={`Tentang ${item.label}`}
                      >
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      {item.hint}
                    </TooltipContent>
                  </Tooltip>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
                {item.formatted ??
                  (item.unit === "percent"
                    ? formatPercent(item.value)
                    : item.value === null
                      ? "-"
                      : formatNumber(item.value))}
              </div>
              {comparisonLabel ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <ChangeBadge change={item.change} unit={item.unit} />
                  <span>{comparisonLabel}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
