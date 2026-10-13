"use client";

import { PrinterIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { Icon } from "@/components/profile/icon";

/** Opens the browser's print dialog, where the invoice can also be saved as PDF. */
export function PrintButton(): ReactNode {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-11 items-center gap-2 rounded-full bg-[#111827] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
    >
      <Icon icon={PrinterIcon} className="size-[18px]" />
      Cetak / simpan PDF
    </button>
  );
}
