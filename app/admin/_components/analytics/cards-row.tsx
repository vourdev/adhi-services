import type { ReactNode } from "react";

/** 12-column row used by the reference dashboard; stacks below xl. */
export function CardsRow({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
      {children}
    </div>
  );
}
