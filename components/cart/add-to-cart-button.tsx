"use client";

import {
  ShoppingCartAdd01Icon,
  ShoppingCartCheck01Icon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";

import { addToCartAction } from "@/app/_actions/cart";
import { Icon } from "@/components/profile/icon";

/**
 * Puts the product in the cart. Shows a check once it is in, and reports the
 * result to screen readers; the cart count in the header refreshes with the
 * page.
 */
export function AddToCartButton({
  productId,
  inCart,
  className = "",
}: {
  productId: string;
  inCart: boolean;
  className?: string;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function add() {
    startTransition(async () => {
      const result = await addToCartAction(productId);
      setMessage(result.ok ? "Ditambahkan ke keranjang" : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={add}
        disabled={pending}
        aria-label={inCart ? "Sudah di keranjang" : "Tambah ke keranjang"}
        className={`grid shrink-0 place-items-center transition-opacity disabled:opacity-60 ${className}`}
      >
        <Icon
          icon={inCart ? ShoppingCartCheck01Icon : ShoppingCartAdd01Icon}
          className="size-[22px]"
        />
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
