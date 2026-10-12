import type { DiscountCode } from "@/db/schema";
import { toLocalWib } from "@/lib/pricing";
import type { DiscountCodeFormValues } from "@/lib/validation";

export const NEW_DISCOUNT_CODE: DiscountCodeFormValues = {
  code: "",
  discountType: "percent",
  discountValue: 10,
  productId: "",
  maxUses: null,
  startsAt: "",
  endsAt: "",
  isActive: true,
};

export function toFormValues(code: DiscountCode): DiscountCodeFormValues {
  return {
    code: code.code,
    discountType: code.discountType,
    discountValue: code.discountValue,
    productId: code.productId ?? "",
    maxUses: code.maxUses,
    startsAt: toLocalWib(code.startsAt),
    endsAt: toLocalWib(code.endsAt),
    isActive: code.isActive,
  };
}
