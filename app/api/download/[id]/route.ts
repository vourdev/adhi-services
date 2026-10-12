import { type NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { authSecret } from "@/lib/env";
import { verifyExpiring } from "@/lib/security";
import { authorizeDownload } from "@/server/checkout";
import { openPrivateFile } from "@/server/storage";

const MESSAGES: Record<string, string> = {
  invalid:
    "Link unduhan tidak valid atau sudah kedaluwarsa. Buka lagi halaman pesanan Anda untuk link baru.",
  not_found: "Unduhan tidak ditemukan.",
  not_paid: "Pesanan belum lunas.",
  revoked: "Akses unduhan sudah dicabut.",
  limit_reached: "Batas unduhan sudah tercapai. Hubungi penjual.",
  unavailable: "File belum tersedia. Hubungi penjual.",
};

function deny(reason: keyof typeof MESSAGES, status: number) {
  return new NextResponse(MESSAGES[reason], {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Signed, expiring download for a paid order. The signature proves the link
 * came from the order page; the database check proves the order is paid.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  if (
    !verifyExpiring(
      authSecret(),
      `download:${id}`,
      searchParams.get("exp"),
      searchParams.get("sig")
    )
  ) {
    return deny("invalid", 403);
  }

  const grant = await authorizeDownload(getDb(), id);
  if (!grant.ok)
    return deny(grant.reason, grant.reason === "not_found" ? 404 : 403);

  if (grant.kind === "link") {
    const response = NextResponse.redirect(grant.url, 302);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const file = await openPrivateFile(grant.fileKey);
  if (!file) return deny("unavailable", 404);
  const asciiName = grant.fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/"/g, "");
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(grant.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
