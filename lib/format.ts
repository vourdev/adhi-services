const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("id-ID");
const compact = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "Rp25.000". Whole rupiah only. */
export function formatRupiah(amount: number): string {
  return rupiah.format(amount).replace(/\s/g, "");
}

export function formatNumber(value: number): string {
  return integer.format(value);
}

export function formatCompact(value: number): string {
  return value < 10_000 ? integer.format(value) : compact.format(value);
}

/** "12,5%" or "-" when the rate is undefined (zero denominator). */
export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;
}

export function formatDateTime(ms: number | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(ms);
}

export function formatDate(ms: number | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(ms);
}

/** "5 menit lalu" style relative time. */
export function formatRelative(ms: number, nowMs = Date.now()): string {
  const seconds = Math.round((ms - nowMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
