import type { Device, EventType } from "@/lib/domain";

export const EVENT_LABELS: Record<EventType, string> = {
  profile_view: "Kunjungan profil",
  link_click: "Klik link",
  product_view: "Lihat produk",
  product_click: "Klik produk",
  whatsapp_checkout_clicked: "Klik pesan via WhatsApp",
  checkout_started: "Buka checkout",
  payment_initiated: "Pembayaran dibuat",
  payment_succeeded: "Pembayaran berhasil",
  payment_failed: "Pembayaran gagal",
};

export const DEVICE_LABELS: Record<Device, string> = {
  mobile: "Ponsel",
  tablet: "Tablet",
  desktop: "Komputer",
  unknown: "Tidak diketahui",
};

export const UNIQUE_VISITOR_HINT =
  "Jumlah browser berbeda (cookie acak pihak pertama) yang membuka profil atau halaman produk di periode ini. Ini menghitung browser, bukan orang: satu orang di dua perangkat, atau di browser Instagram lalu Chrome, terhitung dua.";
export const CTR_HINT =
  "Klik link ÷ tayangan profil × 100. Link CTR memakai penyebut yang sama, jadi jumlahnya sama dengan CTR total.";
