"use client";

import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import type { DateRange as DayRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  type DateRange,
  RANGE_LABELS,
  RANGE_PRESETS,
  type RangePreset,
  TIMEZONE_LABEL,
} from "@/lib/analytics/range";

/**
 * Period filter. The selection lives in the URL (?range=7d or
 * ?range=custom&from=...&to=...), so every card and chart on the page is
 * computed on the server for the same period, and the view can be shared
 * or reloaded.
 */
export function DateRangeFilter({
  range,
  extraParams = {},
}: {
  range: DateRange;
  extraParams?: Record<string, string>;
}): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | undefined>({
    from: parseISO(range.from),
    to: parseISO(range.to),
  });

  function navigate(params: Record<string, string>) {
    const search = new URLSearchParams({ ...extraParams, ...params });
    startTransition(() =>
      router.push(`${pathname}?${search.toString()}`, { scroll: false })
    );
  }

  function onPresetChange(value: string) {
    if (value === "custom") {
      setOpen(true);
      return;
    }
    navigate({ range: value });
  }

  function applyCustom() {
    if (!draft?.from) return;
    const to = draft.to ?? draft.from;
    navigate({
      range: "custom",
      from: format(draft.from, "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd"),
    });
    setOpen(false);
  }

  const customLabel =
    range.preset === "custom"
      ? `${format(parseISO(range.from), "d MMM", { locale: localeId })} - ${format(parseISO(range.to), "d MMM yyyy", { locale: localeId })}`
      : "Pilih tanggal";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending ? <Spinner aria-label="Memuat data" /> : null}
      <Select value={range.preset} onValueChange={onPresetChange}>
        <SelectTrigger className="w-44" aria-label="Periode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {RANGE_PRESETS.map((preset: RangePreset) => (
              <SelectItem key={preset} value={preset}>
                {RANGE_LABELS[preset]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="font-normal"
            aria-label="Pilih rentang tanggal"
          >
            <CalendarDays />
            {customLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="end">
          <Calendar
            mode="range"
            locale={localeId}
            defaultMonth={draft?.from ?? new Date()}
            {...(draft ? { selected: draft } : {})}
            onSelect={setDraft}
            numberOfMonths={1}
            disabled={{ after: new Date() }}
          />
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <span className="text-xs text-muted-foreground">
              Zona waktu {TIMEZONE_LABEL}
            </span>
            <Button size="sm" onClick={applyCustom} disabled={!draft?.from}>
              Terapkan
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
