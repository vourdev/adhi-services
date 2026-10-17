import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import {
  businessContact,
  ContactInline,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";
import { getDb } from "@/db/client";
import { getPlatformSettings } from "@/server/platform-settings";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description: "Aturan penggunaan layanan, pembelian, dan pengiriman produk.",
  alternates: { canonical: "/syarat-ketentuan" },
};

const list = "flex list-disc flex-col gap-1.5 pl-5";

export default async function TermsPage(): Promise<ReactNode> {
  await connection();
  const settings = await getPlatformSettings(getDb());
  const contact = businessContact(settings);
  const brand = settings.brandName;

  return (
    <LegalPage
      title="Syarat & Ketentuan"
      updated="15 Oktober 2026"
      current="/syarat-ketentuan"
    >
      <p>
        Dengan memakai {brand}, membuka halaman profil, atau membeli produk di
        dalamnya, Anda setuju dengan ketentuan berikut. {brand} dikelola oleh{" "}
        {contact.name}.
      </p>

      <LegalSection title="1. Layanan">
        <p>
          {brand} adalah layanan halaman profil (link in bio) dan toko produk
          digital. Penjual membuat halaman berisi link dan produk; pembeli
          membeli produk tersebut lewat checkout di halaman penjual atau lewat
          WhatsApp penjual.
        </p>
      </LegalSection>

      <LegalSection title="2. Akun penjual">
        <ul className={list}>
          <li>
            Penjual bertanggung jawab menjaga kerahasiaan kata sandi dan semua
            aktivitas di akunnya.
          </li>
          <li>
            Data profil dan produk harus benar. Harga, isi produk, dan cara
            pengiriman yang ditulis penjual menjadi janji penjual kepada
            pembeli.
          </li>
          <li>
            Akun yang melanggar ketentuan ini dapat dinonaktifkan; halaman
            profilnya tidak lagi bisa dibuka.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Pembelian dan pembayaran">
        <ul className={list}>
          <li>
            Harga ditampilkan dalam Rupiah dan sudah final saat checkout,
            termasuk potongan dari kode diskon jika ada.
          </li>
          <li>
            Pembayaran diproses oleh penyedia payment gateway berizin. Metode
            yang tersedia (transfer bank, e-wallet, QRIS, dan lainnya) tampil di
            halaman pembayaran. Data kartu atau rekening tidak pernah disimpan
            di server kami.
          </li>
          <li>
            Pesanan dianggap lunas setelah penyedia pembayaran mengonfirmasi
            pembayaran. Pesanan yang tidak dibayar sampai batas waktu pembayaran
            akan batal dengan sendirinya.
          </li>
          <li>
            Untuk produk yang dipesan lewat WhatsApp, pembayaran dan pengiriman
            disepakati langsung antara pembeli dan penjual.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Pengiriman produk digital">
        <ul className={list}>
          <li>
            Setelah pembayaran lunas, link produk muncul di halaman pesanan dan
            dikirim ke email yang diisi saat checkout.
          </li>
          <li>
            Link pesanan bersifat pribadi. Jangan bagikan link tersebut; jumlah
            unduhan file per pesanan dibatasi.
          </li>
          <li>
            Pastikan alamat email benar saat checkout. Jika email tidak masuk,
            periksa folder spam atau hubungi kami dengan menyebutkan nomor
            pesanan.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Refund">
        <p>
          Produk digital tidak dapat dikembalikan setelah akses diberikan,
          kecuali dalam kondisi yang dijelaskan di{" "}
          <Link
            href="/kebijakan-refund"
            className="underline underline-offset-2"
          >
            Kebijakan Refund
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. Penggunaan yang dilarang">
        <p>Penjual dan pembeli tidak boleh memakai layanan ini untuk:</p>
        <ul className={list}>
          <li>
            menjual produk ilegal, bajakan, atau yang melanggar hak kekayaan
            intelektual orang lain;
          </li>
          <li>penipuan, phishing, atau menyebarkan malware;</li>
          <li>
            konten pornografi, perjudian, ujaran kebencian, atau yang melanggar
            hukum Indonesia;
          </li>
          <li>
            mengganggu sistem, misalnya membanjiri server dengan permintaan
            otomatis.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Tanggung jawab">
        <ul className={list}>
          <li>
            Isi dan kualitas produk adalah tanggung jawab penjual. {brand}{" "}
            menyediakan halaman, checkout, dan pengiriman link produk.
          </li>
          <li>
            Kami berusaha menjaga layanan tetap berjalan, tetapi tidak menjamin
            layanan bebas gangguan. Kami tidak bertanggung jawab atas kerugian
            tidak langsung akibat gangguan layanan, sejauh diizinkan hukum.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Privasi">
        <p>
          Cara kami mencatat kunjungan dan menyimpan data pesanan dijelaskan di
          halaman{" "}
          <Link href="/privasi" className="underline underline-offset-2">
            Privasi
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Perubahan ketentuan">
        <p>
          Ketentuan ini dapat diperbarui. Tanggal berlaku di atas menunjukkan
          versi terbaru. Pesanan yang sudah dibayar tetap mengikuti ketentuan
          yang berlaku saat pembelian.
        </p>
      </LegalSection>

      <LegalSection title="10. Kontak">
        <p>
          Pertanyaan tentang ketentuan ini dapat dikirim ke{" "}
          <ContactInline contact={contact} />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
