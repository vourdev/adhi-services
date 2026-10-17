"use client";

import {
  Alert02Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { Toaster, toast } from "sonner";

import { Icon } from "./icon";

/**
 * Toasts on public pages, drawn with the profile's own tokens (it renders
 * inside the profile surface). Used for things that happen beside the
 * form, such as the cart and broken purchase rules; form field errors stay
 * next to their fields.
 */
export function PublicToaster(): ReactNode {
  return (
    <Toaster
      position="top-center"
      visibleToasts={3}
      closeButton
      gap={8}
      offset={16}
      mobileOffset={12}
      toastOptions={{
        unstyled: true,
        duration: 4000,
        closeButtonAriaLabel: "Tutup notifikasi",
        classNames: {
          toast:
            "flex w-[min(24rem,calc(100vw-1.5rem))] items-start gap-3 rounded-[var(--p-r-card)] border border-p-line bg-p-card px-4 py-3 text-[14px] leading-snug text-p-fg shadow-[0_16px_40px_-16px_rgb(0_0_0/0.4)]",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "font-medium",
          description: "text-[13px] text-p-muted",
          icon: "mt-px shrink-0",
          // Rendered first by sonner; order-last puts it at the right end.
          closeButton:
            "order-last -my-0.5 -mr-1.5 grid size-7 shrink-0 place-items-center self-start rounded-full text-p-muted transition-colors hover:bg-p-quiet hover:text-p-fg [&_svg]:size-3.5",
          actionButton:
            "-my-1 ml-auto shrink-0 self-center rounded-[var(--p-r-btn)] bg-p-fg px-3 py-1.5 text-[13px] font-semibold text-p-bg",
          success: "[&_[data-icon]]:text-p-accent-ink",
          info: "[&_[data-icon]]:text-p-muted",
          warning: "border-p-warn/40 [&_[data-icon]]:text-p-warn",
          error: "border-p-sale/40 [&_[data-icon]]:text-p-sale",
        },
      }}
      icons={{
        success: <Icon icon={CheckmarkCircle02Icon} className="size-5" />,
        info: <Icon icon={InformationCircleIcon} className="size-5" />,
        warning: <Icon icon={Alert02Icon} className="size-5" />,
        error: <Icon icon={CancelCircleIcon} className="size-5" />,
      }}
    />
  );
}

export type Tone = "success" | "info" | "warning" | "error";

/** Shows a message in the tone it came with (cart results carry one). */
export function notify(
  tone: Tone,
  message: string,
  action?: { label: string; onClick: () => void }
): void {
  toast[tone](message, action ? { action } : undefined);
}
