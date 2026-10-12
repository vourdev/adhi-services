import type { OrderStatus } from "@/lib/domain";

/**
 * Provider-neutral payment interface. The Midtrans implementation lives in
 * ./midtrans.ts; tests use an in-memory fake.
 */

export type CreateTransactionInput = {
  orderCode: string;
  amount: number;
  item: { id: string; name: string };
  buyer: { name: string; email: string; phone: string | null };
  finishUrl: string;
  /** Sends this transaction's notifications here instead of the URL set in the provider's dashboard. */
  notificationUrl?: string | null;
};

export type GatewayStatus = {
  orderId: string;
  transactionStatus: string;
  fraudStatus: string | null;
  statusCode: string;
  /** Whole rupiah, parsed from the provider's decimal string. */
  grossAmount: number;
  transactionId: string | null;
  paymentType: string | null;
};

export interface PaymentGateway {
  readonly provider: string;
  createTransaction(
    input: CreateTransactionInput
  ): Promise<{ token: string; redirectUrl: string }>;
  /** Authoritative status from the provider's API, or null when the provider has no such order. */
  getStatus(orderCode: string): Promise<GatewayStatus | null>;
  /** Checks the signature of a webhook payload. */
  verifyNotification(payload: NotificationPayload): boolean;
}

export type NotificationPayload = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string | undefined;
  transaction_id?: string | undefined;
  payment_type?: string | undefined;
};

export class GatewayError extends Error {}

/**
 * Midtrans transaction_status (+ fraud_status) to our order status.
 * null means "no change" (e.g. partial refunds, card authorisations).
 */
export function mapProviderStatus(
  transactionStatus: string,
  fraudStatus: string | null
): OrderStatus | null {
  switch (transactionStatus) {
    case "capture":
      if (fraudStatus === "challenge") return "pending";
      if (fraudStatus === "deny") return "failed";
      return "paid";
    case "settlement":
      return "paid";
    case "pending":
      return "pending";
    case "deny":
    case "failure":
      return "failed";
    case "cancel":
      return "cancelled";
    case "expire":
      return "expired";
    case "refund":
    case "chargeback":
      return "refunded";
    default:
      return null;
  }
}

/**
 * Allowed order status transitions. Returns the new status, or null to
 * ignore the update. A paid order is never downgraded by a late "expire";
 * a payment that settles after a failure/expiry still counts as paid.
 */
export function nextOrderStatus(
  current: OrderStatus,
  incoming: OrderStatus | null
): OrderStatus | null {
  if (incoming === null || incoming === current) return null;
  switch (current) {
    case "pending":
      return incoming;
    case "failed":
    case "expired":
    case "cancelled":
      return incoming === "paid" ? "paid" : null;
    case "paid":
      return incoming === "refunded" ? "refunded" : null;
    case "refunded":
      return null;
  }
}

/** "185000.00" -> 185000. Returns null for non-integer rupiah amounts. */
export function parseGrossAmount(value: string | number): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  return Math.abs(amount - rounded) < 0.005 ? rounded : null;
}
