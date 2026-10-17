import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import {
  businessContact,
  LegalPage,
  telHref,
} from "@/components/legal/legal-page";
import { getDb } from "@/db/client";
import { getCurrentOwner } from "@/server/session";
import { getPlatformSettings } from "@/server/platform-settings";

export const metadata: Metadata = {
  title: "Kontak",
  description: "Email, telepon, dan alamat usaha.",
  alternates: { canonical: "/kontak" },
};

export default async function ContactPage(): Promise<ReactNode> {
  await connection();
  const settings = await getPlatformSettings(getDb());
  const contact = businessContact(settings);
  const rows = [
    contact.email
      ? {
          label: "Email",
          value: (
            <a
              href={`mailto:${contact.email}`}
              className="underline underline-offset-2"
            >
              {contact.email}
            </a>
          ),
        }
      : null,
    contact.phone
      ? {
          label: "Telepon",
          value: (
            <a
              href={telHref(contact.phone)}
              className="underline underline-offset-2"
            >
              {contact.phone}
            </a>
          ),
        }
      : null,
    contact.address
      ? {
          label: "Alamat usaha",
          value: <span className="whitespace-pre-line">{contact.address}</span>,
        }
      : null,
  ].filter((row) => row !== null);
  const missing = rows.length < 3;
  // Only the signed-in owner, who can fill the fields, sees what is missing.
  const owner = missing ? await getCurrentOwner() : null;

  return (
    <LegalPage title="Kontak" current="/kontak">
      <p>
        Untuk pertanyaan seputar pesanan, pembayaran, atau refund, hubungi{" "}
        {contact.name}. Sertakan nomor pesanan agar kami bisa membantu lebih
        cepat.
      </p>
      {rows.length > 0 ? (
        <dl className="p-card flex flex-col divide-y divide-p-line">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6"
            >
              <dt className="w-32 shrink-0 text-sm text-p-muted">
                {row.label}
              </dt>
              <dd className="text-p-fg">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {owner ? (
        <p className="rounded-[var(--p-r-card)] border border-dashed border-p-line px-4 py-3 text-sm text-p-muted">
          Hanya Anda (pemilik) yang melihat catatan ini: email, telepon, atau
          alamat usaha belum lengkap. Isi di{" "}
          <Link href="/admin/settings" className="underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      ) : null}
    </LegalPage>
  );
}
