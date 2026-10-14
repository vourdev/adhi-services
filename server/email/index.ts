import "server-only";

import { after } from "next/server";

import { getDb } from "@/db/client";
import { authSecret, emailConfig, siteUrl } from "@/lib/env";

import {
  deliverOrderEmails,
  type EmailDeps,
  sendPaymentLinkEmail,
} from "./order-emails";
import { createResendClient } from "./resend";

/** Email sending from the environment, or null while it is not configured. */
export function emailDeps(): EmailDeps | null {
  const config = emailConfig();
  if (!config) return null;
  const { send, cancel } = createResendClient(config);
  return {
    send,
    cancel,
    fromAddress: config.fromAddress,
    siteUrl: siteUrl(),
    secret: authSecret(),
  };
}

/**
 * Sends the receipt and seller notice for a paid order after the response
 * is finished, so a slow or failing email never holds up a page or a
 * payment notification. Does nothing when email is off or already sent.
 */
export function scheduleOrderEmails(orderId: string): void {
  const deps = emailDeps();
  if (!deps) return;
  after(() =>
    deliverOrderEmails(getDb(), orderId, deps).catch((error: unknown) =>
      console.error("[email] order emails failed", error)
    )
  );
}

/** The buyer's payment link, after the checkout redirect has gone out. */
export function schedulePaymentLinkEmail(orderId: string): void {
  const deps = emailDeps();
  if (!deps) return;
  after(() =>
    sendPaymentLinkEmail(getDb(), orderId, deps).catch((error: unknown) =>
      console.error("[email] payment link email failed", error)
    )
  );
}
