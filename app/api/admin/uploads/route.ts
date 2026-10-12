import { type NextRequest, NextResponse } from "next/server";

import { isSameOrigin } from "@/server/http";
import { getCurrentOwner } from "@/server/session";
import {
  IMAGE_KINDS,
  type ImageKind,
  MAX_FILE_BYTES,
  saveImage,
  savePrivateFile,
  StorageError,
} from "@/server/storage";

/**
 * Owner-only uploads. Images are re-encoded to WebP (which also strips
 * metadata such as GPS location); product files go to private storage.
 */
export async function POST(request: NextRequest) {
  const owner = await getCurrentOwner();
  if (!owner)
    return NextResponse.json(
      { error: "Sesi berakhir. Masuk lagi." },
      { status: 401 }
    );

  if (!isSameOrigin(request))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES + 1024 * 1024)
    return NextResponse.json(
      { error: "File maksimal 50 MB." },
      { status: 413 }
    );

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Upload tidak terbaca." },
      { status: 400 }
    );
  }
  const kind = form.get("kind");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "Pilih file dulu." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (kind === "product-file") {
      const saved = await savePrivateFile(buffer, file.name);
      return NextResponse.json({
        key: saved.key,
        name: saved.name,
        size: saved.size,
      });
    }
    if (
      typeof kind === "string" &&
      (IMAGE_KINDS as readonly string[]).includes(kind)
    ) {
      const saved = await saveImage(buffer, kind as ImageKind);
      return NextResponse.json(saved);
    }
    return NextResponse.json(
      { error: "Jenis upload tidak dikenal." },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof StorageError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[upload] failed", error);
    return NextResponse.json(
      { error: "Upload gagal. Coba lagi." },
      { status: 500 }
    );
  }
}
