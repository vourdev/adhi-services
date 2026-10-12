/**
 * Metric definitions shared by every report.
 *
 * - Overall CTR  = link clicks ÷ profile views × 100
 * - Link CTR     = clicks on that link ÷ profile views × 100 (same denominator,
 *                  so link CTRs add up to the overall CTR)
 * - Product CTR  = product card clicks ÷ profile views × 100
 * - Conversion   = paid orders ÷ product page views × 100
 *
 * A rate is null when its denominator is zero, so the UI can show "-"
 * instead of a misleading 0%.
 */

export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

/** Relative change in percent, or null when there is no previous value to compare with. */
export function percentChange(
  current: number,
  previous: number
): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
