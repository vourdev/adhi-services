import Link from "next/link";
import type { ReactNode } from "react";

export default function NotFound(): ReactNode {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Halaman tidak ditemukan
      </h1>
      <p className="text-muted-foreground">
        Link ini mungkin sudah diubah atau tidak lagi tersedia.
      </p>
      <Link
        href="/"
        className="mt-2 text-sm font-medium underline underline-offset-4"
      >
        Ke halaman utama
      </Link>
    </main>
  );
}
