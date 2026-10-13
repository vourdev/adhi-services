import type { ReactNode } from "react";

export const ctaClass =
  "p-btn p-press flex h-13 w-full items-center justify-center gap-2 bg-p-accent px-6 text-base font-semibold text-p-accent-fg";

/** The product page's buy button, fixed above the phone's home indicator. */
export function BottomBar({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-p-line bg-p-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-p-bg/80">
      <div className="mx-auto max-w-[34rem]">{children}</div>
    </div>
  );
}
