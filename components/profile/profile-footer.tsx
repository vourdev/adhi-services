import Link from "next/link";
import type { ReactNode } from "react";

import { LEGAL_LINKS } from "@/lib/legal-links";

export function ProfileFooter({
  name,
  brandName = "Adhi Web Services",
  hideWatermark = false,
}: {
  name: string;
  brandName?: string | undefined;
  hideWatermark?: boolean | null | undefined;
}): ReactNode {
  return (
    <footer className="mt-14 flex flex-col items-center gap-3 text-[13px] text-p-muted">
      <nav
        aria-label="Informasi"
        className="flex flex-wrap justify-center gap-x-4 gap-y-1.5"
      >
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="underline decoration-p-line underline-offset-4 hover:decoration-p-fg"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <p>
          © {new Date().getFullYear()} {name}
        </p>
        {!hideWatermark ? (
          <span className="text-xs text-p-muted">
            Dibuat dengan{" "}
            <span className="font-semibold text-p-fg">{brandName}</span>
          </span>
        ) : null}
      </div>
    </footer>
  );
}
