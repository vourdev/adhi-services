import { issueSignedToken } from "@vercel/blob";
import {
  type HandleUploadPresignedBody,
  handleUploadPresigned,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { blobStorageEnabled } from "@/lib/env";
import { isProductFilePathname, MAX_FILE_BYTES } from "@/lib/storage-keys";
import { isSameOrigin } from "@/server/http";
import { getCurrentOwner } from "@/server/session";

/**
 * Direct browser-to-Blob uploads for product files, used when a Vercel Blob
 * store is connected. A function request body is capped at 4.5 MB, so files
 * up to 50 MB go straight to the private store with a short-lived token that
 * only allows writing one new `files/<uuid>.<ext>` pathname.
 */
export async function POST(request: Request) {
  if (!blobStorageEnabled())
    return NextResponse.json({ error: "not_available" }, { status: 404 });

  const owner = await getCurrentOwner();
  if (!owner)
    return NextResponse.json(
      { error: "Sesi berakhir. Masuk lagi." },
      { status: 401 }
    );
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json(
      { error: "Upload tidak terbaca." },
      { status: 400 }
    );
  }

  try {
    const result = await handleUploadPresigned({
      request,
      body,
      getSignedToken: async (pathname) => {
        if (!isProductFilePathname(pathname))
          throw new Error("Tipe atau lokasi file tidak didukung.");
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil: Date.now() + 15 * 60 * 1000,
          maximumSizeInBytes: MAX_FILE_BYTES,
        });
        return { token };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[upload] direct upload refused", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.startsWith("Tipe")
            ? error.message
            : "Upload gagal. Coba lagi.",
      },
      { status: 400 }
    );
  }
}
