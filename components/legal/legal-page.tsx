import Link from "next/link";
import type { ReactNode } from "react";

import type { PlatformSettings } from "@/db/schema";

export const LEGAL_LINKS = [
  { href: "/syarat-ketentuan", label: "Syarat & Ketentuan" },
  { href: "/kebijakan-refund", label: "Kebijakan Refund" },
  { href: "/faq", label: "FAQ" },
  { href: "/kontak", label: "Kontak" },
  { href: "/privasi", label: "Privasi" },
] as const;

/** The business behind the platform, as the super admin entered it. Empty fields are null. */
export type BusinessContact = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export function businessContact(settings: PlatformSettings): BusinessContact {
  return {
    name: settings.businessName || settings.brandName,
    email: settings.contactEmail,
    phone: settings.contactPhone,
    address: settings.businessAddress,
  };
}

/** "tel:" target for a typed number: digits and a leading plus only. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Same plain reading layout as the privacy page, with links to the other policies. */
export function LegalPage({
  title,
  updated,
  current,
  children,
}: {
  title: string;
  /** Effective date, shown under the title. */
  updated?: string;
  current: (typeof LEGAL_LINKS)[number]["href"];
  children: ReactNode;
}): ReactNode {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[15px] leading-relaxed">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Kembali
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
      {updated ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Berlaku sejak {updated}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-6 text-foreground/90">
        {children}
      </div>
      <nav
        aria-label="Kebijakan lainnya"
        className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t pt-6 text-sm text-muted-foreground"
      >
        {LEGAL_LINKS.filter((link) => link.href !== current).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** "email@x / 08xx" sentence fragment for policies; falls back to the Kontak page. */
export function ContactInline({
  contact,
}: {
  contact: BusinessContact;
}): ReactNode {
  if (!contact.email && !contact.phone)
    return (
      <Link href="/kontak" className="underline underline-offset-2">
        halaman Kontak
      </Link>
    );
  return (
    <>
      {contact.email ? (
        <a
          href={`mailto:${contact.email}`}
          className="underline underline-offset-2"
        >
          {contact.email}
        </a>
      ) : null}
      {contact.email && contact.phone ? " atau " : null}
      {contact.phone ? (
        <a href={telHref(contact.phone)} className="underline underline-offset-2">
          {contact.phone}
        </a>
      ) : null}
    </>
  );
}
