"use client";

import { useEffect, useRef } from "react";

import type { ClientEventType } from "@/lib/domain";

function eventKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Reports one page view per page load. The key is created once per mount
 * and kept in a ref, so React Strict Mode's double effect or a re-render
 * sends the same key, and the server stores it only once.
 */
export function ViewBeacon({
  type,
  profileId,
  productId,
}: {
  type: ClientEventType;
  profileId: string;
  productId?: string;
}): null {
  const key = useRef<string | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    key.current ??= eventKey();
    const params = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      type,
      eventKey: key.current,
      profileId,
      productId: productId ?? null,
      referrer: document.referrer || null,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    });
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // Analytics must never break the page.
    });
  }, [type, profileId, productId]);

  return null;
}
