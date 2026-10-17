import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privasi",
  description: "Data apa yang dicatat halaman ini dan untuk apa.",
  alternates: { canonical: "/privasi" },
};

/** Plain-language notice for the first-party analytics, the cart and the checkout. */
export default async function PrivacyPage(): Promise<ReactNode> {
  await connection();
  return (
    <LegalPage title="Privasi" current="/privasi">
      <LegalSection title="Statistik kunjungan">
        <p>
          Halaman ini mencatat kunjungan dan klik link untuk mengetahui konten
          mana yang berguna. Yang dicatat: waktu, halaman atau link yang dibuka,
          situs asal (nama domainnya saja), parameter kampanye (utm), dan jenis
          perangkat (ponsel, tablet, atau komputer).
        </p>
        <p>
          Untuk membedakan pengunjung baru dan lama, browser Anda menyimpan
          cookie berisi kode acak (lb_vid, berlaku 1 tahun) dan kode sesi
          (lb_sid, berakhir setelah 30 menit tidak aktif). Kode ini tidak berisi
          nama, email, atau nomor telepon. Alamat IP dan user agent lengkap
          tidak disimpan. Tidak ada layanan analitik pihak ketiga.
        </p>
        <p>
          Keranjang belanja disimpan di cookie lb_cart (berlaku 30 hari) yang
          hanya berisi kode produk, tanpa data pribadi.
        </p>
      </LegalSection>
      <LegalSection title="Pembelian">
        <p>
          Saat membeli produk lewat checkout langsung, nama, email, dan nomor
          WhatsApp (jika diisi) disimpan untuk memproses dan mengirim pesanan.
          Pembayaran diproses oleh penyedia payment gateway; data kartu atau
          rekening tidak pernah melewati server ini.
        </p>
        <p>
          Untuk produk yang dipesan lewat WhatsApp, percakapan berlangsung
          langsung di WhatsApp dan tidak disimpan di sini.
        </p>
      </LegalSection>
      <LegalSection title="Menghapus data">
        <p>
          Anda bisa menghapus cookie lewat pengaturan browser. Untuk meminta
          data pesanan dihapus, hubungi pemilik halaman lewat kontak di
          profilnya.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
