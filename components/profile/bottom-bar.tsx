import type { ReactNode } from "react";

export const ctaClass =
  "p-btn p-press flex h-13 w-full items-center justify-center gap-2 bg-p-accent px-6 text-base font-semibold text-p-accent-fg";

/**
 * The product page's order button on phones, fixed above the home
 * indicator, with the price beside it. Wide screens show the button in the
 * page instead (see the product page), so this bar is hidden there.
 */
export function BottomBar({
  price,
  children,
}: {
  /** The amount the button is for; omitted when ordering is not open. */
  price?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <div
      data-bottom-bar=""
      className="fixed inset-x-0 bottom-0 z-10 border-t border-p-line bg-p-bg/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-[34rem] items-center gap-4">
        {price ? (
          <div className="flex shrink-0 flex-col">
            <span className="text-[12px] font-medium text-p-muted">Harga</span>
            {price}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
