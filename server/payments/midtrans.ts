import { createHash } from "node:crypto";

import type { MidtransConfig } from "@/lib/env";
import { safeEqual } from "@/lib/security";

import {
  type CreateTransactionInput,
  GatewayError,
  type GatewayStatus,
  type NotificationPayload,
  type PaymentGateway,
  parseGrossAmount,
} from "./gateway";

/**
 * Midtrans Snap (redirect mode) over plain fetch.
 *
 * - Create:  POST {snap}/snap/v1/transactions  -> { token, redirect_url }
 *            (X-Override-Notification routes one transaction's webhooks)
 * - Status:  GET  {api}/v2/{order_id}/status
 * - Webhook: signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
 *
 * Docs: https://docs.midtrans.com/docs/snap-snap-integration-guide
 *       https://docs.midtrans.com/docs/https-notification-webhooks
 */

const SNAP_BASE = {
  sandbox: "https://app.sandbox.midtrans.com",
  production: "https://app.midtrans.com",
};
const API_BASE = {
  sandbox: "https://api.sandbox.midtrans.com",
  production: "https://api.midtrans.com",
};

export function midtransSignature(
  payload: Pick<
    NotificationPayload,
    "order_id" | "status_code" | "gross_amount"
  >,
  serverKey: string
): string {
  return createHash("sha512")
    .update(
      `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`
    )
    .digest("hex");
}

export function createMidtransGateway(
  config: MidtransConfig,
  fetchImpl: typeof fetch = fetch
): PaymentGateway {
  const env = config.isProduction ? "production" : "sandbox";
  const authorization = `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: authorization,
  };

  return {
    provider: "midtrans",

    async createTransaction(input: CreateTransactionInput) {
      const body = {
        transaction_details: {
          order_id: input.orderCode,
          gross_amount: input.amount,
        },
        // Midtrans requires the item prices to add up to gross_amount.
        item_details: input.items.map((item) => ({
          id: item.id.slice(0, 50),
          price: item.price,
          quantity: 1,
          name: item.name.slice(0, 50),
        })),
        customer_details: {
          first_name: input.buyer.name.slice(0, 60),
          email: input.buyer.email,
          ...(input.buyer.phone ? { phone: input.buyer.phone } : {}),
        },
        // 3-D Secure for card payments.
        credit_card: { secure: true },
        // Per order, so the buyer returns with the order's secret link. Only
        // the Unfinish redirect is left to the dashboard (no per-order field).
        callbacks: {
          finish: input.finishUrl,
          ...(input.errorUrl ? { error: input.errorUrl } : {}),
        },
      };

      let response: Response;
      try {
        response = await fetchImpl(`${SNAP_BASE[env]}/snap/v1/transactions`, {
          method: "POST",
          headers: input.notificationUrl
            ? { ...headers, "X-Override-Notification": input.notificationUrl }
            : headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        throw new GatewayError("Tidak bisa menghubungi Midtrans.", {
          cause: error,
        });
      }

      const data = (await response.json().catch(() => null)) as {
        token?: unknown;
        redirect_url?: unknown;
        error_messages?: unknown;
      } | null;
      if (
        !response.ok ||
        typeof data?.token !== "string" ||
        typeof data.redirect_url !== "string"
      ) {
        const detail = Array.isArray(data?.error_messages)
          ? data.error_messages.join("; ")
          : `HTTP ${response.status}`;
        throw new GatewayError(`Midtrans menolak transaksi: ${detail}`);
      }
      return { token: data.token, redirectUrl: data.redirect_url };
    },

    async getStatus(orderCode: string): Promise<GatewayStatus | null> {
      let response: Response;
      try {
        response = await fetchImpl(
          `${API_BASE[env]}/v2/${encodeURIComponent(orderCode)}/status`,
          {
            headers,
            signal: AbortSignal.timeout(15_000),
          }
        );
      } catch (error) {
        throw new GatewayError("Tidak bisa menghubungi Midtrans.", {
          cause: error,
        });
      }
      const data = (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      if (response.status === 404 || data?.status_code === "404") return null;
      if (
        !response.ok ||
        !data ||
        typeof data.transaction_status !== "string" ||
        typeof data.order_id !== "string"
      ) {
        throw new GatewayError(
          `Status Midtrans tidak terbaca (HTTP ${response.status}).`
        );
      }
      const grossAmount = parseGrossAmount(String(data.gross_amount ?? ""));
      if (grossAmount === null)
        throw new GatewayError("Nominal dari Midtrans tidak valid.");
      return {
        orderId: data.order_id,
        transactionStatus: data.transaction_status,
        fraudStatus:
          typeof data.fraud_status === "string" ? data.fraud_status : null,
        statusCode: String(data.status_code ?? ""),
        grossAmount,
        transactionId:
          typeof data.transaction_id === "string" ? data.transaction_id : null,
        paymentType:
          typeof data.payment_type === "string" ? data.payment_type : null,
      };
    },

    verifyNotification(payload: NotificationPayload): boolean {
      return safeEqual(
        midtransSignature(payload, config.serverKey),
        payload.signature_key.toLowerCase()
      );
    },
  };
}
