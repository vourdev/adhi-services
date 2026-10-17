import type { MidtransConfig } from "@/lib/env";

/**
 * Whether checkout works. The site takes payments into one Midtrans account,
 * set by MIDTRANS_SERVER_KEY. The environment is passed in, so the rules can
 * be tested without env variables.
 */

export type PaymentEnvironment = {
  /** The Midtrans account, or null when MIDTRANS_SERVER_KEY is not set. */
  platform: MidtransConfig | null;
  /** Production without a public https SITE_URL: no finish redirect and no webhooks. */
  siteUrlMissing: boolean;
};

export type PaymentsMissing = "MIDTRANS_SERVER_KEY" | "SITE_URL";

export type PaymentsStatus =
  | { ready: true; mode: "sandbox" | "production" }
  | { ready: false; missing: PaymentsMissing[] };

/** Sandbox keys start with SB-; everything else is production. */
export function isProductionKey(serverKey: string): boolean {
  return !serverKey.startsWith("SB-");
}

/** Status and credentials for new orders. */
export function resolveCheckoutAccount(env: PaymentEnvironment): {
  status: PaymentsStatus;
  config: MidtransConfig | null;
} {
  const missing: PaymentsMissing[] = [];
  if (!env.platform) missing.push("MIDTRANS_SERVER_KEY");
  if (env.siteUrlMissing) missing.push("SITE_URL");
  if (!env.platform || missing.length > 0)
    return { status: { ready: false, missing }, config: null };
  return {
    status: {
      ready: true,
      mode: env.platform.isProduction ? "production" : "sandbox",
    },
    config: env.platform,
  };
}
