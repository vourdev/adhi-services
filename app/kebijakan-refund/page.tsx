import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

import {
  businessContact,
  ContactInline,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";
import { getDb } from "@/db/client";
import { getPlatformSettings } from "@/server/super-admin";

export const metadata: Metadata = {
  title: "Kebijakan Refund",
  description: "Kapan dana bisa dikembalikan dan cara mengajukannya.",
  alternates: { canonical: "/kebijakan-refund" },
};

const list = "flex list-disc flex-col gap-1.5 pl-5";

export default async function RefundPolicyPage(): Promise<ReactNode> {
  await connection();
  const contact = businessContact(await getPlatformSettings(getDb()));

  return (
    <LegalPage
      title="Kebijakan Refund"
      updated="15 Oktober 2026"
      current="/kebijakan-refund"
    >
      <p>
        Produk yang dijual di sini adalah produk digital. Setelah pembayaran
        lunas, akses ke produk langsung diberikan dan tidak bisa ditarik
        kembali. Karena itu, pembelian yang sudah dibayar pada dasarnya tidak
        dapat direfund.
      </p>

      <LegalSection title="Kapan dana dikembalikan">
        <p>Dana dikembalikan penuh jika:</p>
        <ul className={list}>
          <li>
            <strong>Pembayaran ganda.</strong> Anda membayar lebih dari sekali
            untuk pesanan yang sama.
          </li>
          <li>
            <strong>Produk tidak terkirim.</strong> Pembayaran sudah lunas tetapi
            link produk tidak muncul di halaman pesanan maupun email, dan tidak
            bisa kami perbaiki.
          </li>
          <li>
            <strong>Produk tidak bisa diakses.</strong> File atau link rusak
            dan tidak diperbaiki setelah Anda melaporkannya.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Yang tidak termasuk refund">
        <ul className={list}>
          <li>Berubah pikiran setelah produk diterima atau diunduh.</li>
          <li>Salah membeli produk atau tidak membaca deskripsi produk.</li>
          <li>
            Salah menulis alamat email. Link produk tetap bisa dibuka dari
            halaman pesanan; hubungi kami untuk bantuan.
          </li>
          <li>
            Pesanan yang dibayar lewat WhatsApp penjual. Refund untuk pesanan
            ini diurus langsung dengan penjual.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cara mengajukan">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Kirim permintaan ke <ContactInline contact={contact} />.
          </li>
          <li>
            Sertakan nomor pesanan (contoh: LB-XXXXXXXX), email yang dipakai
            saat checkout, alasan refund, dan bukti pendukung (misalnya bukti
            pembayaran ganda atau tangkapan layar error).
          </li>
          <li>
            Kami memeriksa permintaan Anda dan mengabarkan hasilnya lewat
            email.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="Proses pengembalian dana">
        <ul className={list}>
          <li>
            Permintaan yang disetujui diproses paling lambat 14 hari kerja
            sejak disetujui.
          </li>
          <li>
            Dana dikembalikan ke rekening bank atau e-wallet atas nama pembeli,
            sebesar jumlah yang dibayarkan.
          </li>
          <li>
            Setelah refund, akses ke produk pada pesanan tersebut dinonaktifkan.
          </li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
