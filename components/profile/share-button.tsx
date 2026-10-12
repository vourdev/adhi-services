"use client";

import { Share08Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { type ReactNode, useState } from "react";

import { Icon } from "./icon";

/**
 * Opens the phone's share sheet for this page; copies the link where the
 * share sheet is not available. Shares the clean URL, without the UTM
 * parameters the visitor arrived with.
 */
export function ShareButton({ title }: { title: string }): ReactNode {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closing the share sheet rejects; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Salin link ini:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex h-10 items-center gap-2 rounded-full bg-p-card px-4 text-[14px] font-semibold text-p-fg shadow-[0_1px_2px_rgb(17_24_39/0.05)] ring-1 ring-p-line transition-transform duration-150 hover:ring-p-fg/20 active:scale-95 motion-reduce:active:scale-100"
    >
      <Icon icon={copied ? Tick02Icon : Share08Icon} className="size-4.5" />
      <span aria-live="polite">{copied ? "Link disalin" : "Bagikan"}</span>
    </button>
  );
}
