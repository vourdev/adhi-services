/**
 * How many units of a product one order may hold. Shared by the product
 * form, the cart, the checkout page and the server, so every place applies
 * the same limits and says the same thing about them.
 */

/** Ceiling when the owner sets no maximum. */
export const MAX_LINE_QUANTITY = 99;

export type QuantityLimits = { min: number; max: number };

export function quantityLimits(product: {
  minQuantity: number;
  maxQuantity: number | null;
}): QuantityLimits {
  const min = Math.min(Math.max(product.minQuantity, 1), MAX_LINE_QUANTITY);
  const max = Math.max(
    Math.min(product.maxQuantity ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY),
    min
  );
  return { min, max };
}

export function clampQuantity(
  quantity: number,
  limits: QuantityLimits
): number {
  return Math.min(
    Math.max(Math.floor(quantity) || limits.min, limits.min),
    limits.max
  );
}

/** Why a quantity is not allowed, as a sentence for the buyer; null when it is. */
export function quantityProblem(
  name: string,
  quantity: number,
  limits: QuantityLimits
): string | null {
  if (quantity > limits.max)
    return `Maksimal ${limits.max} per transaksi untuk ${name}.`;
  if (quantity < limits.min)
    return `Minimal pembelian ${name} adalah ${limits.min}.`;
  return null;
}

/** "Maksimal 1 per transaksi", "Minimal 2 per transaksi", both, or null without limits. */
export function describeLimits(limits: QuantityLimits): string | null {
  const hasMin = limits.min > 1;
  const hasMax = limits.max < MAX_LINE_QUANTITY;
  if (hasMin && hasMax)
    return limits.min === limits.max
      ? `Dibeli ${limits.min} per transaksi`
      : `Minimal ${limits.min}, maksimal ${limits.max} per transaksi`;
  if (hasMin) return `Minimal ${limits.min} per transaksi`;
  if (hasMax) return `Maksimal ${limits.max} per transaksi`;
  return null;
}
