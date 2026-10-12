import "server-only";

import type { Database } from "@/db/client";
import type { Order } from "@/db/schema";
import type { MidtransMode, UserRole } from "@/lib/domain";
import {
  encryptionSecret,
  hasPublicSiteUrl,
  isProduction,
  midtransConfig,
  siteUrl,
} from "@/lib/env";

import {
  loadPaymentProfile,
  openServerKey,
  orderAccountConfig,
  type PaymentEnvironment,
  type PaymentsStatus,
  type ProfilePaymentSettings,
  resolveCheckoutAccount,
} from "./accounts";
import type { PaymentGateway } from "./gateway";
import { createMidtransGateway } from "./midtrans";

export type { PaymentsStatus, ProfilePaymentSettings } from "./accounts";

function environment(): PaymentEnvironment {
  return {
    platform: midtransConfig(),
    siteUrlMissing: isProduction && !hasPublicSiteUrl(),
    encryptionSecret: encryptionSecret(),
  };
}

/** The platform's own gateway, or null when MIDTRANS_SERVER_KEY is not set. */
export function getPaymentGateway(): PaymentGateway | null {
  const config = midtransConfig();
  return config ? createMidtransGateway(config) : null;
}

/** Readiness of the platform's own account (what the super admin configures). */
export function paymentsStatus(): PaymentsStatus {
  return resolveCheckoutAccount(
    { id: "", midtransMode: "platform", customMidtransServerKey: null },
    true,
    environment()
  ).status;
}

/** Whether new orders on this profile can be paid, and into which account. */
export function paymentsStatusForProfile(
  settings: ProfilePaymentSettings,
  premium: boolean
): PaymentsStatus {
  return resolveCheckoutAccount(settings, premium, environment()).status;
}

/**
 * The gateway for a new order on this profile, or null when checkout is not
 * available. Payments on a member's own account send their notifications
 * to this site directly (X-Override-Notification), so the member does not
 * have to configure anything in their Midtrans dashboard.
 */
export function checkoutGateway(
  settings: ProfilePaymentSettings,
  premium: boolean
): {
  gateway: PaymentGateway;
  account: MidtransMode;
  notificationUrl: string | null;
} | null {
  const { status, config } = resolveCheckoutAccount(
    settings,
    premium,
    environment()
  );
  if (!status.ready || !config) return null;
  return {
    gateway: createMidtransGateway(config),
    account: status.account,
    notificationUrl:
      status.account === "custom" && hasPublicSiteUrl()
        ? `${siteUrl()}/api/payments/midtrans`
        : null,
  };
}

/** The gateway for new orders on a profile, checking its owner too. */
export async function checkoutGatewayForProfile(
  db: Database,
  profileId: string
): Promise<ReturnType<typeof checkoutGateway>> {
  const loaded = await loadPaymentProfile(db, profileId);
  if (!loaded || !loaded.ownerActive) return null;
  return checkoutGateway(loaded.settings, loaded.premium);
}

/** Readiness shown on public product pages. */
export async function paymentsStatusForPublicProfile(
  db: Database,
  profileId: string
): Promise<PaymentsStatus | null> {
  const loaded = await loadPaymentProfile(db, profileId);
  if (!loaded || !loaded.ownerActive) return null;
  return paymentsStatusForProfile(loaded.settings, loaded.premium);
}

/** The gateway that can verify and query an existing order, or null. */
export async function gatewayForOrder(
  db: Database,
  order: Pick<Order, "profileId" | "paymentAccount">
): Promise<PaymentGateway | null> {
  const loaded = await loadPaymentProfile(db, order.profileId);
  if (!loaded) return null;
  const config = orderAccountConfig(order, loaded.settings, environment());
  return config ? createMidtransGateway(config) : null;
}

/** "...abcd" for the saved key, so the owner can tell which one it is. Null when none can be read. */
export function savedServerKeyHint(
  settings: ProfilePaymentSettings
): string | null {
  const serverKey = openServerKey(settings, encryptionSecret());
  return serverKey ? `…${serverKey.slice(-4)}` : null;
}

/**
 * What blocks checkout, in words for whoever is reading. Members never see
 * environment variable names; the super admin does, because they set them.
 */
export function describePaymentsProblem(
  status: PaymentsStatus,
  role: UserRole
): string | null {
  if (status.ready) return null;
  const { missing } = status;
  if (missing.includes("PREMIUM"))
    return "Akun Midtrans sendiri hanya untuk paket Premium. Perpanjang Premium, atau pilih Midtrans platform di Settings.";
  if (missing.includes("CUSTOM_SERVER_KEY"))
    return "Server Key Midtrans Anda belum tersimpan. Isi di Settings.";
  if (role === "super_admin") {
    const names = missing.filter(
      (name) => name === "MIDTRANS_SERVER_KEY" || name === "SITE_URL"
    );
    return `${names.join(" dan ")} belum diatur di environment server.`;
  }
  if (missing.includes("MIDTRANS_SERVER_KEY"))
    return "Pembayaran online platform belum diaktifkan oleh admin.";
  return "Pengaturan server untuk pembayaran belum lengkap. Hubungi admin platform.";
}
