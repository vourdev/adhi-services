import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privasi",
  description: "Data apa yang dicatat halaman ini dan untuk apa.",
  alternates: { canonical: "/privasi" },
};

/** Plain-language notice for the first-party analytics and the checkout. */
export default function PrivacyPage(): ReactNode {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[15px] leading-relaxed">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Kembali
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Privasi</h1>
      <div className="mt-6 flex flex-col gap-5 text-foreground/90">
        <section>
          <h2 className="text-lg font-semibold">Statistik kunjungan</h2>
          <p className="mt-2">
            Halaman ini mencatat kunjungan dan klik link untuk mengetahui konten
            mana yang berguna. Yang dicatat: waktu, halaman atau link yang
            dibuka, situs asal (nama domainnya saja), parameter kampanye (utm),
            dan jenis perangkat (ponsel, tablet, atau komputer).
          </p>
          <p className="mt-2">
            Untuk membedakan pengunjung baru dan lama, browser Anda menyimpan
            cookie berisi kode acak (lb_vid, berlaku 1 tahun) dan kode sesi
            (lb_sid, berakhir setelah 30 menit tidak aktif). Kode ini tidak
            berisi nama, email, atau nomor telepon. Alamat IP dan user agent
            lengkap tidak disimpan. Tidak ada layanan analitik pihak ketiga.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Pembelian</h2>
          <p className="mt-2">
            Saat membeli produk lewat checkout langsung, nama, email, dan nomor
            WhatsApp (jika diisi) disimpan untuk memproses dan mengirim pesanan.
            Pembayaran diproses oleh Midtrans; data kartu atau rekening tidak
            pernah melewati server ini.
          </p>
          <p className="mt-2">
            Untuk produk yang dipesan lewat WhatsApp, percakapan berlangsung
            langsung di WhatsApp dan tidak disimpan di sini.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Menghapus data</h2>
          <p className="mt-2">
            Anda bisa menghapus cookie lewat pengaturan browser. Untuk meminta
            data pesanan dihapus, hubungi pemilik halaman lewat kontak di
            profilnya.
          </p>
        </section>
      </div>
    </main>
  );
}
