import type { UserPlan, UserRole } from "./domain";

/**
 * Premium rules shared by the session, the public pages and the dashboard.
 * Free of runtime imports so it works on the server, in the browser and in
 * tests.
 */

export type PlanHolder = {
  role: UserRole;
  plan: UserPlan;
  planExpiresAt: Date | null;
};

/**
 * The plan in force right now. Premium past its expiry date counts as free;
 * the super admin runs the platform and always has premium.
 */
export function effectivePlan(user: PlanHolder, nowMs = Date.now()): UserPlan {
  if (user.role === "super_admin") return "premium";
  if (user.plan !== "premium") return "free";
  return user.planExpiresAt !== null && user.planExpiresAt.getTime() <= nowMs
    ? "free"
    : "premium";
}

export function hasPremium(user: PlanHolder, nowMs = Date.now()): boolean {
  return effectivePlan(user, nowMs) === "premium";
}

const DAY_MS = 86_400_000;

/**
 * When a premium grant of `durationDays` ends. An active premium with an end
 * date is extended from that date, so adding a month never shortens what
 * the member already has; otherwise it counts from now. No duration means
 * no end date.
 */
export function premiumEndDate(
  current: { plan: UserPlan; planExpiresAt: Date | null },
  durationDays: number | null | undefined,
  nowMs = Date.now()
): Date | null {
  if (!durationDays) return null;
  const activeEnd =
    current.plan === "premium" &&
    current.planExpiresAt !== null &&
    current.planExpiresAt.getTime() > nowMs
      ? current.planExpiresAt.getTime()
      : nowMs;
  return new Date(activeEnd + durationDays * DAY_MS);
}

/** True when the stored plan says premium but its expiry date has passed. */
export function isPlanExpired(user: PlanHolder, nowMs = Date.now()): boolean {
  return (
    user.role !== "super_admin" &&
    user.plan === "premium" &&
    user.planExpiresAt !== null &&
    user.planExpiresAt.getTime() <= nowMs
  );
}

/** Profile fields only a premium owner may change. */
export const PREMIUM_PROFILE_FIELDS = [
  "themePreset",
  "customTheme",
  "fontFamily",
  "cardShape",
  "cardStyle",
  "hideWatermark",
  "customFaviconUrl",
  "ogImageUrl",
  "trackingPixels",
] as const;

export type PremiumProfileField = (typeof PREMIUM_PROFILE_FIELDS)[number];

/**
 * What visitors see for those fields when the owner is on free. Stored
 * values are kept, so they come back when premium is renewed.
 */
export const FREE_PROFILE_LOOK = {
  themePreset: "default",
  customTheme: null,
  fontFamily: "Plus Jakarta Sans",
  cardShape: "smooth",
  cardStyle: "solid",
  hideWatermark: false,
  customFaviconUrl: null,
  ogImageUrl: null,
  trackingPixels: null,
} as const satisfies Record<PremiumProfileField, unknown>;

/** Drops premium-only fields from an update, so a free owner cannot set them. */
export function withoutPremiumFields<T extends object>(
  input: T
): Omit<T, PremiumProfileField> {
  const copy = { ...input } as Record<string, unknown>;
  for (const field of PREMIUM_PROFILE_FIELDS) delete copy[field];
  return copy as Omit<T, PremiumProfileField>;
}
