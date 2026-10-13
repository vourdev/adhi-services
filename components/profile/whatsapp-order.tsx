"use client";

import { WhatsappIcon } from "@hugeicons/core-free-icons";
import { type ReactNode, useState } from "react";

import { formatRupiah } from "@/lib/format";

import { PriceTag } from "./blocks";
import { BottomBar, ctaClass } from "./bottom-bar";
import { type AppliedDiscount, DiscountCodeField } from "./discount-code-field";
import { Icon } from "./icon";

/**
 * WhatsApp ordering on the product page: an optional discount code in the
 * page, and the order button (in the page on wide screens, fixed at the
 * bottom on phones). The code goes to /go/wa as ?kode=, which checks it
 * again before writing it into the chat message.
 */
export function WhatsAppOrder({
  productId,
  price,
  label,
  discountEnabled,
}: {
  productId: string;
  price: number;
  label: string;
  discountEnabled: boolean;
}): ReactNode {
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const href = `/go/wa/${productId}${discount ? `?kode=${encodeURIComponent(discount.code)}` : ""}`;
  const button = (
    <a href={href} rel="nofollow" className={ctaClass}>
      <Icon icon={WhatsappIcon} className="size-5" />
      {label}
    </a>
  );

  return (
    <>
      {discountEnabled ? (
        <div className="flex flex-col gap-2.5">
          <DiscountCodeField
            productId={productId}
            applied={discount}
            onChange={setDiscount}
          />
          {discount ? (
            <p className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
              Harga dengan kode
              <span className="font-bold text-p-price tabular-nums">
                {formatRupiah(discount.finalPrice)}
              </span>
              <span className="text-[14px] text-p-muted tabular-nums line-through">
                <span className="sr-only">Harga normal </span>
                {formatRupiah(price)}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="hidden lg:block">{button}</div>
      <BottomBar price={<PriceTag amount={discount?.finalPrice ?? price} />}>
        {button}
      </BottomBar>
    </>
  );
}
