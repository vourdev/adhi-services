import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { profiles, users } from "@/db/schema";
import type { MidtransMode } from "@/lib/domain";
import type { MidtransConfig } from "@/lib/env";
import { hasPremium } from "@/lib/plan";
import { openSecret, sealSecret } from "@/lib/secret-box";

/**
 * Which Midtrans account takes a profile's payments. The environment is
 * passed in, so the rules can be tested without env variables.
 *
 * - "platform": the site's own account (MIDTRANS_SERVER_KEY).
 * - "custom": the member's own account, premium only. Its server key is
 *   stored encrypted and never leaves the server.
 *
 * A profile set to its own account never falls back to the platform's:
 * buyers would otherwise pay the wrong merchant without anyone noticing.
 */

export type ProfilePaymentSettings = {
  id: string;
  midtransMode: MidtransMode;
  /** Sealed with lib/secret-box and bound to the profile id. */
  customMidtransServerKey: string | null;
};

export type PaymentEnvironment = {
  /** The platform account, or null when MIDTRANS_SERVER_KEY is not set. */
  platform: MidtransConfig | null;
  /** Production without a public https SITE_URL: no finish redirect and no webhooks. */
  siteUrlMissing: boolean;
  /** ENCRYPTION_KEY, needed to read members' own server keys. */
  encryptionSecret: string | null;
};

export type PaymentsMissing =
  "MIDTRANS_SERVER_KEY" | "SITE_URL" | "PREMIUM" | "CUSTOM_SERVER_KEY";

export type PaymentsStatus =
  | { ready: true; account: MidtransMode; mode: "sandbox" | "production" }
  | { ready: false; account: MidtransMode; missing: PaymentsMissing[] };

function keyContext(profileId: string): string {
  return `midtrans-server-key:${profileId}`;
}

export function sealServerKey(
  profileId: string,
  serverKey: string,
  secret: string
): string {
  return sealSecret(serverKey, keyContext(profileId), secret);
}

/** The member's own server key, or null when none is saved or it cannot be read. */
export function openServerKey(
  settings: Pick<ProfilePaymentSettings, "id" | "customMidtransServerKey">,
  secret: string | null
): string | null {
  if (!settings.customMidtransServerKey || !secret) return null;
  return openSecret(
    settings.customMidtransServerKey,
    keyContext(settings.id),
    secret
  );
}

/** Sandbox keys start with SB-; everything else is production. */
export function isProductionKey(serverKey: string): boolean {
  return !serverKey.startsWith("SB-");
}

function customConfig(
  settings: ProfilePaymentSettings,
  secret: string | null
): MidtransConfig | null {
  const serverKey = openServerKey(settings, secret);
  return serverKey
    ? { serverKey, isProduction: isProductionKey(serverKey) }
    : null;
}

/** Status and credentials for new orders on this profile. */
export function resolveCheckoutAccount(
  settings: ProfilePaymentSettings,
  premium: boolean,
  env: PaymentEnvironment
): { status: PaymentsStatus; config: MidtransConfig | null } {
  const account = settings.midtransMode;
  const missing: PaymentsMissing[] = [];
  let config: MidtransConfig | null;
  if (account === "custom") {
    if (!premium) missing.push("PREMIUM");
    config = customConfig(settings, env.encryptionSecret);
    if (!config) missing.push("CUSTOM_SERVER_KEY");
  } else {
    config = env.platform;
    if (!config) missing.push("MIDTRANS_SERVER_KEY");
  }
  if (env.siteUrlMissing) missing.push("SITE_URL");

  if (!config || missing.length > 0)
    return { status: { ready: false, account, missing }, config: null };
  return {
    status: {
      ready: true,
      account,
      mode: config.isProduction ? "production" : "sandbox",
    },
    config,
  };
}

/**
 * Credentials for an order that already exists: the account it was created
 * on. The current plan and settings do not matter, since the money already
 * went there.
 */
export function orderAccountConfig(
  order: { paymentAccount: MidtransMode },
  settings: ProfilePaymentSettings,
  env: PaymentEnvironment
): MidtransConfig | null {
  return order.paymentAccount === "custom"
    ? customConfig(settings, env.encryptionSecret)
    : env.platform;
}

/** A profile's payment settings plus what its owner may do. */
export async function loadPaymentProfile(
  db: Database,
  profileId: string,
  nowMs = Date.now()
): Promise<{
  settings: ProfilePaymentSettings;
  premium: boolean;
  ownerActive: boolean;
} | null> {
  const [row] = await db
    .select({
      id: profiles.id,
      midtransMode: profiles.midtransMode,
      customMidtransServerKey: profiles.customMidtransServerKey,
      role: users.role,
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      status: users.status,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.ownerId))
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!row) return null;
  return {
    settings: {
      id: row.id,
      midtransMode: row.midtransMode,
      customMidtransServerKey: row.customMidtransServerKey,
    },
    premium: hasPremium(row, nowMs),
    ownerActive: row.status === "active",
  };
}
