"use client";

import { Share08Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { type ReactNode, useState } from "react";

import { Icon } from "./icon";
import { notify } from "./toaster";

/**
 * Opens the phone's share sheet for this page; copies the link where the
 * share sheet is not available. Shares the clean URL, without the UTM
 * parameters the visitor arrived with.
 */
export function ShareButton({
  title,
  compact = false,
  className,
}: {
  title: string;
  /** Icon only (the label is still read out). */
  compact?: boolean;
  className?: string;
}): ReactNode {
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
      notify("success", "Link disalin. Tempel di chat atau media sosial.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Salin link ini:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={
        className ??
        "p-tile p-press flex h-10 items-center gap-2 rounded-[var(--p-r-btn)] px-4 text-[14px] font-semibold text-p-fg"
      }
    >
      <Icon icon={copied ? Tick02Icon : Share08Icon} className="size-4.5" />
      <span aria-live="polite" className={compact ? "sr-only" : undefined}>
        {copied ? "Link disalin" : "Bagikan"}
      </span>
    </button>
  );
}
