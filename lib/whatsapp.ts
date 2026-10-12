/**
 * Pure helpers for wa.me links. No imports, so tests can load this file
 * directly with Node's type stripping.
 */

/** Keeps digits only and turns a local Indonesian "08..." number into "628...". */
export function normalizeWhatsAppNumber(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

/** International format without "+": country code first, 10 to 15 digits. */
export function isValidWhatsAppNumber(input: string): boolean {
  return /^[1-9]\d{9,14}$/.test(normalizeWhatsAppNumber(input));
}

/**
 * Builds a click-to-chat link. The visitor still reviews and sends the
 * message inside WhatsApp; nothing is sent automatically.
 *
 * Without a valid number the link falls back to WhatsApp's contact picker.
 * Callers that face visitors check the number first (the services page
 * returns 404 and products cannot be published without one).
 */
export function buildWhatsAppUrl(number: string, message: string): string {
  const text = encodeURIComponent(message.trim());
  if (!isValidWhatsAppNumber(number)) {
    return `https://wa.me/?text=${text}`;
  }
  return `https://wa.me/${normalizeWhatsAppNumber(number)}?text=${text}`;
}

/** Human-readable number, e.g. "+62 812-3456-7890". Empty when invalid. */
export function formatWhatsAppNumber(input: string): string {
  if (!isValidWhatsAppNumber(input)) return "";
  const digits = normalizeWhatsAppNumber(input);
  if (!digits.startsWith("62")) return `+${digits}`;
  const rest = digits.slice(2);
  const groups = [rest.slice(0, 3), rest.slice(3, 7), rest.slice(7)].filter(
    Boolean
  );
  return `+62 ${groups.join("-")}`;
}

/**
 * Fills a product message template. Supported placeholders: {produk},
 * {harga} and {link}. Unknown placeholders are left as typed.
 */
export function renderWhatsAppTemplate(
  template: string,
  values: { produk: string; harga: string; link: string }
): string {
  return template
    .replaceAll("{produk}", values.produk)
    .replaceAll("{harga}", values.harga)
    .replaceAll("{link}", values.link)
    .trim();
}
