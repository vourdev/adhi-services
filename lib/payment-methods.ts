/**
 * The payment gateway's payment_type as buyers know it, for invoices and
 * emails. Never names the gateway itself. Unknown types give null, so the
 * line is left out rather than showing a code.
 */
const LABELS: Record<string, string> = {
  bank_transfer: "Transfer bank (virtual account)",
  echannel: "Mandiri Bill",
  permata: "Virtual account Permata",
  qris: "QRIS",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  dana: "DANA",
  credit_card: "Kartu kredit/debit",
  cstore: "Gerai retail",
  akulaku: "Akulaku",
  kredivo: "Kredivo",
};

export function paymentMethodLabel(
  paymentType: string | null | undefined
): string | null {
  return paymentType ? (LABELS[paymentType] ?? null) : null;
}
