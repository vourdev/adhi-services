import { ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/profile/icon";

/**
 * The cart icon with the number of products in it; opens the checkout. The
 * count is rendered on the server from the cart cookie.
 */
export function CartLink({
  username,
  count,
  className = "",
}: {
  username: string;
  count: number;
  className?: string;
}): ReactNode {
  return (
    <Link
      href={`/${username}/checkout`}
      prefetch={false}
      aria-label={count > 0 ? `Keranjang, ${count} produk` : "Keranjang"}
      className={`relative grid size-10 shrink-0 place-items-center ${className}`}
    >
      <Icon icon={ShoppingCart01Icon} className="size-5" />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-p-accent px-1 text-[11px] font-bold text-p-accent-fg tabular-nums ring-2 ring-p-bg"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
