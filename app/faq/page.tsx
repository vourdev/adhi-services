import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import {
  businessContact,
  ContactInline,
  LegalPage,
} from "@/components/legal/legal-page";
import { getDb } from "@/db/client";
import { getPlatformSettings } from "@/server/super-admin";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Pertanyaan yang sering diajukan tentang pembelian dan pesanan.",
  alternates: { canonical: "/faq" },
};

const link = "underline underline-offset-2";

export default async function FaqPage(): Promise<ReactNode> {
  await connection();
  const settings = await getPlatformSettings(getDb());
  const contact = businessContact(settings);

  const items: { q: string; a: ReactNode }[] = [
    {
      q: `Apa itu ${settings.brandName}?`,
      a: (
        <p>
          Layanan halaman profil (link in bio) dan toko produk digital. Penjual
          menaruh link dan produknya di satu halaman; pembeli bisa membeli
          langsung dari halaman tersebut.
        </p>
      ),
    },
    {
      q: "Bagaimana cara membeli produk?",
      a: (
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          <li>Buka halaman produk, lalu tekan tombol beli.</li>
          <li>Isi nama dan email. Masukkan kode diskon jika punya.</li>
          <li>Pilih metode pembayaran dan selesaikan pembayaran.</li>
          <li>
            Setelah lunas, link produk muncul di halaman pesanan dan dikirim ke
            email Anda.
          </li>
        </ol>
      ),
    },
    {
      q: "Metode pembayaran apa saja yang tersedia?",
      a: (
        <p>
          Transfer bank lewat virtual account, e-wallet, QRIS, dan metode lain
          yang tampil di halaman pembayaran. Pembayaran diproses oleh penyedia
          payment gateway berizin.
        </p>
      ),
    },
    {
      q: "Kapan saya menerima produknya?",
      a: (
        <p>
          Segera setelah pembayaran terkonfirmasi, biasanya dalam beberapa
          menit. Untuk transfer bank, konfirmasi bisa sedikit lebih lama
          tergantung bank.
        </p>
      ),
    },
    {
      q: "Email pesanan tidak masuk. Apa yang harus saya lakukan?",
      a: (
        <p>
          Periksa folder Spam atau Promosi, lalu tandai email tersebut sebagai
          bukan spam. Jika tetap tidak ada, hubungi kami dengan menyebutkan
          nomor pesanan dan email yang dipakai saat checkout.
        </p>
      ),
    },
    {
      q: "Saya kehilangan link pesanan.",
      a: (
        <p>
          Link pesanan ada di email konfirmasi pembayaran. Jika email tersebut
          hilang, hubungi kami dengan nomor pesanan dan email checkout; kami
          akan mengirim ulang link setelah memastikan pesanan milik Anda.
        </p>
      ),
    },
    {
      q: "Apakah saya bisa meminta refund?",
      a: (
        <p>
          Produk digital tidak bisa direfund setelah akses diberikan, kecuali
          pembayaran ganda, produk tidak terkirim, atau produk tidak bisa
          diakses. Detailnya ada di{" "}
          <Link href="/kebijakan-refund" className={link}>
            Kebijakan Refund
          </Link>
          .
        </p>
      ),
    },
    {
      q: "Apakah data pembayaran saya aman?",
      a: (
        <p>
          Data kartu dan rekening diproses langsung oleh penyedia pembayaran dan
          tidak pernah disimpan di server kami. Lihat{" "}
          <Link href="/privasi" className={link}>
            Privasi
          </Link>{" "}
          untuk data apa saja yang kami simpan.
        </p>
      ),
    },
    {
      q: "Produk yang dipesan lewat WhatsApp bagaimana?",
      a: (
        <p>
          Pesanan lewat WhatsApp dibayar dan dikirim langsung oleh penjual.
          Pertanyaan tentang pesanan tersebut silakan ditanyakan ke penjual di
          percakapan WhatsApp yang sama.
        </p>
      ),
    },
    {
      q: "Bagaimana menghubungi kami?",
      a: (
        <p>
          Kirim pesan ke <ContactInline contact={contact} />. Alamat lengkap ada
          di{" "}
          <Link href="/kontak" className={link}>
            halaman Kontak
          </Link>
          .
        </p>
      ),
    },
  ];

  return (
    <LegalPage title="Pertanyaan Umum (FAQ)" current="/faq">
      <div className="flex flex-col divide-y border-y">
        {items.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <span
                aria-hidden
                className="mt-0.5 text-muted-foreground transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-3 text-foreground/80">{item.a}</div>
          </details>
        ))}
      </div>
    </LegalPage>
  );
}
