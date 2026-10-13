import type { ReactNode } from "react";

import { MIDTRANS_DASHBOARD_FIELDS, midtransUrls } from "@/lib/midtrans-urls";

import { CopyButton } from "../../../_components/copy-button";

/** The URLs to paste into a Midtrans dashboard, in its order, each with a copy button. */
export function MidtransDashboardUrls({
  siteUrl,
  publicSite,
}: {
  siteUrl: string;
  /** False on localhost or without SITE_URL: Midtrans cannot reach the site yet. */
  publicSite: boolean;
}): ReactNode {
  const urls = midtransUrls(siteUrl);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          URL untuk dashboard Midtrans
        </span>
        <span className="text-xs text-muted-foreground">
          Salin ke Midtrans → Settings → Payment. Setiap pesanan sudah membawa
          URL selesai, gagal, dan notifikasinya sendiri, jadi isian ini menjadi
          cadangan. Unfinish Redirect URL hanya bisa diatur di sana.
        </span>
      </div>
      <dl className="flex flex-col divide-y rounded-lg border">
        {MIDTRANS_DASHBOARD_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <dt className="flex flex-col gap-0.5 sm:w-56 sm:shrink-0">
              <span className="text-xs font-medium">{field.label}</span>
              <span className="text-xs text-muted-foreground">
                {field.description}
              </span>
            </dt>
            <dd className="flex min-w-0 flex-1 items-center gap-1.5">
              <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5 text-xs break-all">
                {urls[field.key]}
              </code>
              <CopyButton
                value={urls[field.key]}
                label={`Salin ${field.label}`}
                size="icon-sm"
                variant="ghost"
              />
            </dd>
          </div>
        ))}
      </dl>
      {!publicSite ? (
        <span className="text-xs text-muted-foreground">
          Midtrans hanya bisa memanggil domain https publik, bukan localhost.
        </span>
      ) : null}
    </div>
  );
}
