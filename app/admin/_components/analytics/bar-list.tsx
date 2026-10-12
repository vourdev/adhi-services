import type { ReactNode } from "react";

import { formatNumber, formatPercent } from "@/lib/format";

export type BarListItem = {
  key: string;
  label: ReactNode;
  value: number;
  detail?: string;
};

/**
 * Horizontal magnitude bars in plain HTML. Every value is printed next to
 * its bar, so nothing depends on hover or colour.
 */
export function BarList({
  items,
  total,
  valueLabel,
}: {
  items: BarListItem[];
  total?: number;
  valueLabel: string;
}): ReactNode {
  const max = Math.max(1, ...items.map((item) => item.value));
  const sum = total ?? items.reduce((acc, item) => acc + item.value, 0);
  return (
    <ul className="flex flex-col gap-2.5" aria-label={valueLabel}>
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1"
        >
          <div className="relative min-w-0 overflow-hidden rounded-md">
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-md bg-chart-1/15"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
            <div className="relative truncate px-2.5 py-1.5 text-sm">
              {item.label}
            </div>
          </div>
          <div className="text-right text-sm tabular-nums">
            <span className="font-medium">{formatNumber(item.value)}</span>
            <span className="ml-2 inline-block w-12 text-xs text-muted-foreground">
              {item.detail ??
                formatPercent(sum ? (item.value / sum) * 100 : null, 0)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
