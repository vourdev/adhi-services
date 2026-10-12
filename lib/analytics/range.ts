/**
 * Reporting periods. Days are counted in WIB (UTC+7, no daylight saving),
 * the owner's time zone, so "today" starts at 00:00 Jakarta time.
 */

export const TIMEZONE_LABEL = "WIB";
export const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_DAYS = 366;

export const RANGE_PRESETS = ["today", "7d", "30d", "90d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Hari ini",
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  "90d": "90 hari terakhir",
  custom: "Rentang khusus",
};

export type DateRange = {
  preset: RangePreset;
  /** Inclusive start, epoch ms. */
  startMs: number;
  /** Exclusive end, epoch ms. */
  endMs: number;
  /** Inclusive first and last day, YYYY-MM-DD in WIB. */
  from: string;
  to: string;
  days: number;
};

/** YYYY-MM-DD of the WIB calendar day containing `ms`. */
export function dayKey(ms: number): string {
  return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** Epoch ms of 00:00 WIB on the given YYYY-MM-DD. */
export function startOfDayMs(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`) - TZ_OFFSET_MS;
}

function isDayKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function build(preset: RangePreset, fromKey: string, toKey: string): DateRange {
  const startMs = startOfDayMs(fromKey);
  const endMs = startOfDayMs(toKey) + DAY_MS;
  return {
    preset,
    startMs,
    endMs,
    from: fromKey,
    to: toKey,
    days: Math.round((endMs - startMs) / DAY_MS),
  };
}

export function parseRange(
  params: {
    range?: string | string[] | undefined;
    from?: string | string[] | undefined;
    to?: string | string[] | undefined;
  },
  nowMs = Date.now()
): DateRange {
  const preset = typeof params.range === "string" ? params.range : undefined;
  const today = dayKey(nowMs);
  const daysAgo = (n: number) => dayKey(startOfDayMs(today) - n * DAY_MS);

  switch (preset) {
    case "today":
      return build("today", today, today);
    case "7d":
      return build("7d", daysAgo(6), today);
    case "90d":
      return build("90d", daysAgo(89), today);
    case "custom": {
      let from = isDayKey(params.from) ? params.from : undefined;
      let to = isDayKey(params.to) ? params.to : undefined;
      if (!from || !to) break;
      if (from > to) [from, to] = [to, from];
      if (to > today) to = today;
      if (from > to) from = to;
      const span =
        Math.round((startOfDayMs(to) - startOfDayMs(from)) / DAY_MS) + 1;
      if (span > MAX_CUSTOM_DAYS)
        from = dayKey(startOfDayMs(to) - (MAX_CUSTOM_DAYS - 1) * DAY_MS);
      return build("custom", from, to);
    }
  }
  return build("30d", daysAgo(29), today);
}

/** The period of equal length right before `range`, for comparisons. */
export function previousRange(range: DateRange): DateRange {
  const to = dayKey(range.startMs - DAY_MS);
  const from = dayKey(range.startMs - range.days * DAY_MS);
  return build(range.preset, from, to);
}

export function eachDay(range: DateRange): string[] {
  const keys: string[] = [];
  for (let ms = range.startMs; ms < range.endMs; ms += DAY_MS)
    keys.push(dayKey(ms));
  return keys;
}

export function rangeToSearchParams(range: DateRange): string {
  return range.preset === "custom"
    ? `range=custom&from=${range.from}&to=${range.to}`
    : `range=${range.preset}`;
}

export function describeRange(range: DateRange): string {
  if (range.preset !== "custom") return RANGE_LABELS[range.preset];
  const format = (key: string) =>
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${key}T00:00:00Z`));
  return range.from === range.to
    ? format(range.from)
    : `${format(range.from)} - ${format(range.to)}`;
}
