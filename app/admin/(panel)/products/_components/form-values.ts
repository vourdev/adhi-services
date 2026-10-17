import type { Product } from "@/db/schema";

import type { ProductFormValues } from "./product-form";

export const NEW_PRODUCT: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  coverUrl: "",
  priceAmount: 0,
  compareAtAmount: null,
  productType: "digital",
  status: "draft",
  isFeatured: false,
  showOnProfile: true,
  checkoutMethod: "whatsapp",
  ctaLabel: "",
  minQuantity: 1,
  maxQuantity: null,
  whatsappNumber: "",
  whatsappTemplate: "",
  deliveryType: "none",
  deliveryFileKey: "",
  deliveryFileName: "",
  deliveryFileSize: null,
  deliveryUrl: "",
  seoTitle: "",
  seoDescription: "",
};

export function toFormValues(
  product: Product,
  showOnProfile: boolean
): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    coverUrl: product.coverUrl ?? "",
    priceAmount: product.priceAmount,
    compareAtAmount: product.compareAtAmount,
    productType: product.productType,
    status: product.status,
    isFeatured: product.isFeatured,
    showOnProfile,
    checkoutMethod: product.checkoutMethod,
    ctaLabel: product.ctaLabel ?? "",
    minQuantity: product.minQuantity,
    maxQuantity: product.maxQuantity,
    whatsappNumber: product.whatsappNumber ?? "",
    whatsappTemplate: product.whatsappTemplate ?? "",
    deliveryType: product.deliveryType,
    deliveryFileKey: product.deliveryFileKey ?? "",
    deliveryFileName: product.deliveryFileName ?? "",
    deliveryFileSize: product.deliveryFileSize,
    deliveryUrl: product.deliveryUrl ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
  };
}
