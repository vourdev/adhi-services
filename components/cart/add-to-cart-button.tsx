"use client";

import {
  ShoppingCartAdd01Icon,
  ShoppingCartCheck01Icon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";

import { addToCartAction } from "@/app/_actions/cart";
import { Icon } from "@/components/profile/icon";
import { notify } from "@/components/profile/toaster";

/**
 * Puts one more unit of the product in the cart. The result is a toast:
 * added (with a way to the cart), or the rule that stopped it, such as the
 * product's maximum per transaction or a full cart. The cart count in the
 * header refreshes with the page.
 */
export function AddToCartButton({
  productId,
  cartHref,
  inCart,
  className = "",
}: {
  productId: string;
  cartHref: string;
  inCart: boolean;
  className?: string;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await addToCartAction(productId);
      if (!result.ok) {
        notify(result.tone, result.message);
        return;
      }
      notify(result.tone, result.message, {
        label: "Lihat keranjang",
        onClick: () => router.push(cartHref),
      });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={pending}
      aria-label={inCart ? "Tambah lagi ke keranjang" : "Tambah ke keranjang"}
      className={`grid shrink-0 place-items-center transition-opacity disabled:opacity-60 ${className}`}
    >
      <Icon
        icon={inCart ? ShoppingCartCheck01Icon : ShoppingCartAdd01Icon}
        className="size-[22px]"
      />
    </button>
  );
}
