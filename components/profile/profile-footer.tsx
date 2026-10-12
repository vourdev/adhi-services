import Link from "next/link";
import type { ReactNode } from "react";

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
    <footer className="mt-14 flex flex-col items-center justify-between gap-3 text-[13px] text-p-muted sm:flex-row">
      <p>
        © {new Date().getFullYear()} {name}
      </p>
      <div className="flex items-center gap-3">
        {!hideWatermark ? (
          <span className="text-xs text-p-muted">
            Dibuat dengan{" "}
            <span className="font-semibold text-p-fg">{brandName}</span>
          </span>
        ) : null}
        <Link
          href="/privasi"
          className="underline decoration-p-line underline-offset-4 hover:decoration-p-fg"
        >
          Privasi
        </Link>
      </div>
    </footer>
  );
}
