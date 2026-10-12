import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** Previous/next paging that keeps the current filters in the URL. */
export function Pager({
  page,
  pageCount,
  total,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string>;
}): ReactNode {
  if (pageCount <= 1)
    return <p className="text-xs text-muted-foreground">{total} data</p>;
  const href = (target: number) =>
    `${basePath}?${new URLSearchParams({ ...params, page: String(target) }).toString()}`;
  return (
    <nav
      aria-label="Halaman"
      className="flex items-center justify-between gap-2 text-sm"
    >
      <span className="text-xs text-muted-foreground">
        Halaman {page} dari {pageCount} · {total} data
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild={page > 1}
          disabled={page <= 1}
        >
          {page > 1 ? (
            <Link href={href(page - 1)}>
              <ChevronLeft /> Sebelumnya
            </Link>
          ) : (
            <span>
              <ChevronLeft /> Sebelumnya
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          asChild={page < pageCount}
          disabled={page >= pageCount}
        >
          {page < pageCount ? (
            <Link href={href(page + 1)}>
              Berikutnya <ChevronRight />
            </Link>
          ) : (
            <span>
              Berikutnya <ChevronRight />
            </span>
          )}
        </Button>
      </div>
    </nav>
  );
}
