import { accentTokens } from "@/lib/color";
import { formatDateTime, formatRupiah } from "@/lib/format";

/**
 * Order emails as plain HTML (table layout, inline styles, so they hold up
 * in Gmail and Outlook) plus a text version. Pure functions: every value is
 * escaped here, and nothing names the payment gateway.
 */

export type EmailContent = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** `"Name" <address>`, with anything that could break the header removed from the name. */
export function fromHeader(name: string, address: string): string {
  const clean = name
    .replace(/["<>\\]/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return clean ? `"${clean}" <${address}>` : address;
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = "#111827";
const MUTED = "#5b6474";
const LINE = "#e3e6eb";

type Row = { label: string; value: string; strong?: boolean };

function rowsTable(rows: Row[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${rows
    .map(
      (row, index) =>
        `<tr><td style="padding:${index ? "10px" : "0"} 0 0;color:${MUTED};">${escapeHtml(row.label)}</td><td align="right" style="padding:${index ? "10px" : "0"} 0 0;color:${INK};${row.strong ? "font-weight:700;font-size:16px;" : ""}">${escapeHtml(row.value)}</td></tr>`
    )
    .join("")}</table>`;
}

function layout(options: {
  /** Shown by mail apps next to the subject. */
  preheader: string;
  sender: string;
  accent: string;
  heading: string;
  intro: string;
  button: { label: string; url: string } | null;
  /** Already-built HTML blocks (rows tables, notes). */
  blocks: string[];
  footer: string;
}): string {
  const { fill, onFill } = accentTokens(options.accent).light;
  const button = options.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr><td style="border-radius:999px;background:${fill};"><a href="${escapeHtml(options.button.url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:${onFill};text-decoration:none;border-radius:999px;">${escapeHtml(options.button.label)}</a></td></tr></table>`
    : "";
  const blocks = options.blocks
    .map(
      (block) =>
        `<tr><td style="padding:20px 28px 0;"><div style="border:1px solid ${LINE};border-radius:12px;padding:18px;">${block}</div></td></tr>`
    )
    .join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.heading)}</title></head><body style="margin:0;padding:0;background:#f1f3f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f6;padding:24px 12px;font-family:${FONT};"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="padding:24px 28px 0;font-size:14px;font-weight:700;color:${INK};">${escapeHtml(options.sender)}</td></tr>
<tr><td style="padding:20px 28px 0;"><h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(options.heading)}</h1><p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:${INK};">${options.intro}</p>${button}</td></tr>
${blocks}
<tr><td style="padding:24px 28px 28px;font-size:12.5px;line-height:1.6;color:${MUTED};">${options.footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function textBody(lines: (string | null | false)[]): string {
  return lines.filter((line) => line !== null && line !== false).join("\n");
}

// --------------------------------------------------------------- buyer

/** "A", "A dan B", or "A dan 2 produk lainnya", for subjects and sentences. */
export function productSummary(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} dan ${names[1]}`;
  return `${names[0]} dan ${names.length - 1} produk lainnya`;
}

export type ReceiptEmail = {
  sellerName: string;
  brandName: string;
  accent: string;
  buyerName: string;
  orderCode: string;
  /** Each product with its price before the discount code. */
  products: { name: string; listAmount: number }[];
  discountCode: string | null;
  discountAmount: number;
  total: number;
  paidAt: Date;
  paymentMethod: string | null;
  orderUrl: string;
  invoiceUrl: string;
  /** A file or link to hand over (otherwise the seller follows up). */
  hasDelivery: boolean;
};

/** Sent once the payment is confirmed: the invoice and the way to the product. */
export function receiptEmail(input: ReceiptEmail): EmailContent {
  const productName = productSummary(input.products.map((p) => p.name));
  const rows: Row[] = [
    { label: "Nomor invoice", value: input.orderCode },
    { label: "Tanggal bayar", value: formatDateTime(input.paidAt) },
    ...(input.paymentMethod
      ? [{ label: "Metode", value: input.paymentMethod }]
      : []),
    ...input.products.map((product) => ({
      label: product.name,
      value: formatRupiah(product.listAmount),
    })),
    ...(input.discountCode
      ? [
          {
            label: `Diskon (${input.discountCode})`,
            value: `−${formatRupiah(input.discountAmount)}`,
          },
        ]
      : []),
    { label: "Total dibayar", value: formatRupiah(input.total), strong: true },
  ];
  const next = input.hasDelivery
    ? "Produk Anda siap. Buka lewat tombol di bawah; halaman pesanan menyimpan link unduhannya."
    : "Penjual akan menghubungi Anda untuk langkah berikutnya.";
  const subject = `Pembayaran berhasil: ${productName}`;
  return {
    subject,
    html: layout({
      preheader: `Invoice ${input.orderCode}, ${formatRupiah(input.total)}. ${next}`,
      sender: input.sellerName,
      accent: input.accent,
      heading: "Pembayaran berhasil",
      intro: `Terima kasih, ${escapeHtml(input.buyerName)}. Pembayaran untuk <strong>${escapeHtml(productName)}</strong> sudah diterima. ${escapeHtml(next)}`,
      button: {
        label: input.hasDelivery ? "Buka produk" : "Lihat pesanan",
        url: input.orderUrl,
      },
      blocks: [
        `<div style="font-size:13px;font-weight:700;color:${INK};margin-bottom:12px;">Invoice <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:#e7f6ee;color:#0f7a43;font-size:11px;">LUNAS</span></div>${rowsTable(rows)}<p style="margin:14px 0 0;font-size:13px;"><a href="${escapeHtml(input.invoiceUrl)}" style="color:${INK};">Lihat atau cetak invoice</a></p>`,
      ],
      footer: `Simpan email ini. Tombol di atas adalah akses pribadi ke pesanan Anda, jangan dibagikan.<br>Dikirim oleh ${escapeHtml(input.brandName)} untuk ${escapeHtml(input.sellerName)}.`,
    }),
    text: textBody([
      `Pembayaran berhasil`,
      ``,
      `Terima kasih, ${input.buyerName}. Pembayaran untuk ${productName} sudah diterima. ${next}`,
      ``,
      `${input.hasDelivery ? "Buka produk" : "Lihat pesanan"}: ${input.orderUrl}`,
      ``,
      `Invoice ${input.orderCode} (LUNAS)`,
      ...rows.map((row) => `${row.label}: ${row.value}`),
      `Invoice lengkap: ${input.invoiceUrl}`,
      ``,
      `Link di atas adalah akses pribadi ke pesanan Anda, jangan dibagikan.`,
      `Dikirim oleh ${input.brandName} untuk ${input.sellerName}.`,
    ]),
  };
}

export type PaymentLinkEmail = {
  sellerName: string;
  brandName: string;
  accent: string;
  buyerName: string;
  orderCode: string;
  /** One product, or a summary from productSummary(). */
  productName: string;
  total: number;
  orderUrl: string;
};

/** Sent when the order is created, so a closed payment page is not a lost order. */
export function paymentLinkEmail(input: PaymentLinkEmail): EmailContent {
  const rows: Row[] = [
    { label: "Nomor pesanan", value: input.orderCode },
    { label: "Produk", value: input.productName },
    { label: "Total", value: formatRupiah(input.total), strong: true },
  ];
  return {
    subject: `Selesaikan pembayaran: ${input.productName}`,
    html: layout({
      preheader: `Pesanan ${input.orderCode} menunggu pembayaran ${formatRupiah(input.total)}.`,
      sender: input.sellerName,
      accent: input.accent,
      heading: "Pesanan menunggu pembayaran",
      intro: `Halo ${escapeHtml(input.buyerName)}, pesanan Anda masih menunggu pembayaran. Kalau halaman pembayaran tadi tertutup, lanjutkan lewat tombol di bawah.`,
      button: { label: "Lanjutkan pembayaran", url: input.orderUrl },
      blocks: [rowsTable(rows)],
      footer: `Sudah membayar? Abaikan email ini; invoice dikirim begitu pembayaran diterima.<br>Dikirim oleh ${escapeHtml(input.brandName)} untuk ${escapeHtml(input.sellerName)}.`,
    }),
    text: textBody([
      `Pesanan menunggu pembayaran`,
      ``,
      `Halo ${input.buyerName}, pesanan Anda masih menunggu pembayaran. Kalau halaman pembayaran tadi tertutup, lanjutkan di sini:`,
      input.orderUrl,
      ``,
      ...rows.map((row) => `${row.label}: ${row.value}`),
      ``,
      `Sudah membayar? Abaikan email ini; invoice dikirim begitu pembayaran diterima.`,
      `Dikirim oleh ${input.brandName} untuk ${input.sellerName}.`,
    ]),
  };
}

// -------------------------------------------------------------- seller

export type SellerOrderEmail = {
  brandName: string;
  sellerName: string;
  orderCode: string;
  /** One product, or a summary from productSummary(). */
  productName: string;
  total: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  paidAt: Date;
  paymentMethod: string | null;
  dashboardUrl: string;
  /** Whether the buyer got a file or link automatically. */
  hasDelivery: boolean;
};

/** Tells the seller a payment came in. */
export function sellerOrderEmail(input: SellerOrderEmail): EmailContent {
  const rows: Row[] = [
    { label: "Nomor pesanan", value: input.orderCode },
    { label: "Produk", value: input.productName },
    { label: "Pembeli", value: input.buyerName },
    { label: "Email", value: input.buyerEmail },
    ...(input.buyerPhone
      ? [{ label: "WhatsApp", value: input.buyerPhone }]
      : []),
    { label: "Dibayar", value: formatDateTime(input.paidAt) },
    ...(input.paymentMethod
      ? [{ label: "Metode", value: input.paymentMethod }]
      : []),
    { label: "Total", value: formatRupiah(input.total), strong: true },
  ];
  return {
    subject: `Pesanan baru: ${input.productName} (${formatRupiah(input.total)})`,
    html: layout({
      preheader: `${input.buyerName} membayar ${formatRupiah(input.total)} untuk ${input.productName}.`,
      sender: input.brandName,
      accent: "#111827",
      heading: "Ada pembayaran masuk",
      intro: `Halo ${escapeHtml(input.sellerName)}, <strong>${escapeHtml(input.buyerName)}</strong> baru saja membayar <strong>${escapeHtml(input.productName)}</strong>.`,
      button: { label: "Lihat di dashboard", url: input.dashboardUrl },
      blocks: [rowsTable(rows)],
      footer: `${
        input.hasDelivery
          ? "Produknya sudah dikirim otomatis ke pembeli lewat email dan halaman pesanan."
          : "Produk ini tidak punya file atau link otomatis. Hubungi pembeli untuk langkah berikutnya."
      }<br>${escapeHtml(input.brandName)}`,
    }),
    text: textBody([
      `Ada pembayaran masuk`,
      ``,
      `${input.buyerName} baru saja membayar ${input.productName}.`,
      ...rows.map((row) => `${row.label}: ${row.value}`),
      ``,
      `Lihat di dashboard: ${input.dashboardUrl}`,
    ]),
  };
}
