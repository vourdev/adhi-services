import "server-only";

import {
  hasPublicSiteUrl,
  isProduction,
  midtransConfig,
  siteUrl,
} from "@/lib/env";
import { midtransUrls } from "@/lib/midtrans-urls";

import {
  type PaymentEnvironment,
  type PaymentsStatus,
  resolveCheckoutAccount,
} from "./accounts";
import type { PaymentGateway } from "./gateway";
import { createMidtransGateway } from "./midtrans";

export type { PaymentsStatus } from "./accounts";

function environment(): PaymentEnvironment {
  return {
    platform: midtransConfig(),
    siteUrlMissing: isProduction && !hasPublicSiteUrl(),
  };
}

/** The gateway, or null when MIDTRANS_SERVER_KEY is not set. Verifies and queries existing orders. */
export function getPaymentGateway(): PaymentGateway | null {
  const config = midtransConfig();
  return config ? createMidtransGateway(config) : null;
}

/** Whether new orders can be paid online. */
export function paymentsStatus(): PaymentsStatus {
  return resolveCheckoutAccount(environment()).status;
}

/**
 * The gateway for a new order, or null when checkout is not available. Every
 * order sends its notifications to this site directly
 * (X-Override-Notification), so a Midtrans dashboard pointing elsewhere (or
 * nowhere) does not lose payments.
 */
export function checkoutGateway(): {
  gateway: PaymentGateway;
  notificationUrl: string | null;
} | null {
  const { status, config } = resolveCheckoutAccount(environment());
  if (!status.ready || !config) return null;
  return {
    gateway: createMidtransGateway(config),
    notificationUrl: hasPublicSiteUrl()
      ? midtransUrls(siteUrl()).notification
      : null,
  };
}

/** What blocks checkout, for the owner (who sets the environment variables). */
export function describePaymentsProblem(status: PaymentsStatus): string | null {
  if (status.ready) return null;
  return `${status.missing.join(" dan ")} belum diatur di environment server.`;
}
