/**
 * Everything a Midtrans dashboard can point at (Settings → Payment), all on
 * this site. Each order also sends its own finish and error redirects and
 * its notification URL, so most dashboard values are a fallback; the
 * Unfinish redirect can only be set there.
 */

export const MIDTRANS_DASHBOARD_FIELDS = [
  {
    key: "finish",
    label: "Finish Redirect URL",
    description: "Halaman setelah pembeli selesai membayar.",
  },
  {
    key: "unfinish",
    label: "Unfinish Redirect URL",
    description: "Pembeli kembali ke toko sebelum membayar.",
  },
  {
    key: "error",
    label: "Error Redirect URL",
    description: "Pembayaran gagal diproses.",
  },
  {
    key: "notification",
    label: "Payment notification URL",
    description: "Status pembayaran dari server Midtrans (webhook).",
  },
  {
    key: "recurring",
    label: "Recurring payment notification URL",
    description:
      "Tagihan berulang. Belum dipakai, notifikasinya diterima saja.",
  },
  {
    key: "accountLinking",
    label: "Account linking notification URL",
    description:
      "Penautan akun GoPay. Belum dipakai, notifikasinya diterima saja.",
  },
] as const;

export type MidtransUrlKey = (typeof MIDTRANS_DASHBOARD_FIELDS)[number]["key"];

/** `site` is the public origin without a trailing slash, e.g. https://adhinugroho.id */
export function midtransUrls(site: string): Record<MidtransUrlKey, string> {
  const base = `${site}/api/payments/midtrans`;
  return {
    finish: `${base}/finish`,
    unfinish: `${base}/unfinish`,
    error: `${base}/error`,
    notification: base,
    recurring: `${base}/recurring`,
    accountLinking: `${base}/account-linking`,
  };
}
