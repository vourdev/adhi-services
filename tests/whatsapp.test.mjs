import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildWhatsAppUrl,
  formatWhatsAppNumber,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp";

test("normalizes local, formatted, and international numbers", () => {
  assert.equal(normalizeWhatsAppNumber("081234567890"), "6281234567890");
  assert.equal(normalizeWhatsAppNumber("+62 812-3456-7890"), "6281234567890");
  assert.equal(normalizeWhatsAppNumber("62 812 3456 7890"), "6281234567890");
  assert.equal(normalizeWhatsAppNumber("WHATSAPP_NUMBER"), "");
});

test("accepts real-looking numbers and rejects placeholders", () => {
  assert.equal(isValidWhatsAppNumber("6281234567890"), true);
  assert.equal(isValidWhatsAppNumber("+62 812-3456-7890"), true);
  assert.equal(isValidWhatsAppNumber("WHATSAPP_NUMBER"), false);
  assert.equal(isValidWhatsAppNumber("12345"), false);
  assert.equal(isValidWhatsAppNumber(""), false);
});

test("builds a wa.me link with the number and an encoded message", () => {
  const message =
    "Halo Adhi, saya tertarik membuat website. Saya ingin konsultasi mengenai kebutuhan, fitur, dan estimasi biayanya.";
  const url = buildWhatsAppUrl("+62 812-3456-7890", message);

  assert.ok(url.startsWith("https://wa.me/6281234567890?text="));
  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/6281234567890");
  assert.equal(parsed.searchParams.get("text"), message);
  assert.ok(!url.includes(" "), "spaces must be encoded");
});

test("encodes characters that would break the query string", () => {
  const message = "Paket A & B? 100% #promo\nBaris kedua";
  const parsed = new URL(buildWhatsAppUrl("6281234567890", message));
  assert.equal(parsed.searchParams.get("text"), message);
  assert.equal([...parsed.searchParams.keys()].length, 1);
});

test("falls back to the contact picker while the number is unresolved", () => {
  const url = buildWhatsAppUrl("WHATSAPP_NUMBER", "Halo");
  assert.equal(url, "https://wa.me/?text=Halo");
});

test("formats the number for display", () => {
  assert.equal(formatWhatsAppNumber("6281234567890"), "+62 812-3456-7890");
  assert.equal(formatWhatsAppNumber("081234567"), "+62 812-3456-7");
  assert.equal(formatWhatsAppNumber("WHATSAPP_NUMBER"), "");
});
