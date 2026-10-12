import { uploadPresigned } from "@vercel/blob/client";
import { ImageUp, Link2, Trash2 } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  ALLOWED_FILE_EXTENSIONS,
  fileExtension,
  filePathname,
  type ImageKind,
  MAX_FILE_BYTES,
  safeFileName,
} from "@/lib/storage-keys";

/**
 * Hosted functions accept request bodies up to 4.5 MB, so larger photos are
 * scaled down in the browser first. The server re-encodes them anyway, at
 * no more than 1600 px.
 */
const IMAGE_UPLOAD_TARGET_BYTES = 3.5 * 1024 * 1024;
const IMAGE_MAX_SIDE = 2560;

async function shrinkImage(file: File): Promise<File> {
  if (file.size <= IMAGE_UPLOAD_TARGET_BYTES) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Not decodable here (e.g. HEIC); the server decides.
  }
  const scale = Math.min(
    1,
    IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height)
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of [0.9, 0.8, 0.7]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, quality)
      );
      // A browser that cannot encode the type falls back to PNG; skip that.
      if (blob?.type === type && blob.size <= IMAGE_UPLOAD_TARGET_BYTES) {
        const name = file.name.replace(/\.[^.]+$/, "") || "gambar";
        return new File([blob], `${name}.${type.split("/")[1]}`, { type });
      }
    }
  }
  return file;
}

export async function uploadFile(
  file: File,
  kind: ImageKind | "product-file"
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", kind === "product-file" ? file : await shrinkImage(file));
  const response = await fetch("/api/admin/uploads", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : response.status === 413
          ? "File terlalu besar untuk diunggah."
          : "Upload gagal."
    );
  return data;
}

/**
 * Product file upload. With Vercel Blob the browser sends the file straight
 * to the private store (up to 50 MB); otherwise it goes through the server.
 */
export async function uploadProductFile(
  file: File,
  direct: boolean
): Promise<{ key: string; name: string; size: number }> {
  if (!direct) {
    const data = await uploadFile(file, "product-file");
    return {
      key: String(data.key),
      name: String(data.name),
      size: Number(data.size),
    };
  }
  const extension = fileExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.has(extension))
    throw new Error(
      `Tipe file ${extension || "tanpa ekstensi"} tidak didukung.`
    );
  if (file.size > MAX_FILE_BYTES) throw new Error("File maksimal 50 MB.");
  const key = `${crypto.randomUUID()}${extension}`;
  try {
    await uploadPresigned(filePathname(key), file, {
      access: "private",
      handleUploadUrl: "/api/admin/uploads/blob",
      contentType: "application/octet-stream",
    });
  } catch (error) {
    console.error("[upload] direct upload failed", error);
    throw new Error("Upload gagal. Coba lagi.");
  }
  return { key, name: safeFileName(file.name, extension), size: file.size };
}

/**
 * Image picker: upload (re-encoded to WebP on the server) or paste an https
 * URL. The value is the image URL, or "" for none.
 */
export function ImageField({
  value,
  onChange,
  kind,
  label,
  invalid,
  shape = "square",
}: {
  value: string;
  onChange: (value: string) => void;
  kind: ImageKind;
  label: string;
  invalid?: boolean;
  shape?: "square" | "circle" | "wide";
}): ReactNode {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadFile(file, kind);
      if (typeof data.url === "string") onChange(data.url);
      toast.success("Gambar diunggah");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload gagal.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const previewClass =
    shape === "circle"
      ? "size-16 rounded-full"
      : shape === "wide"
        ? "aspect-[16/7] w-40 rounded-lg"
        : "size-16 rounded-lg";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div
          className={`${previewClass} grid shrink-0 place-items-center overflow-hidden bg-muted ring-1 ring-border`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview of an arbitrary owner image
            <img
              src={value}
              alt={`Pratinjau ${label.toLowerCase()}`}
              className="size-full object-cover"
            />
          ) : (
            <ImageUp className="size-5 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="sr-only"
            id={inputId}
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Spinner /> : <ImageUp />}
            {value ? "Ganti" : "Unggah"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowUrl((open) => !open)}
            aria-expanded={showUrl}
          >
            <Link2 />
            URL
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
            >
              <Trash2 />
              Hapus
            </Button>
          ) : null}
        </div>
      </div>
      {showUrl ? (
        <Input
          aria-label={`URL ${label.toLowerCase()}`}
          placeholder="https://..."
          value={value}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        JPG, PNG, WebP, atau GIF, maksimal 8 MB. Disimpan sebagai WebP tanpa
        metadata lokasi.
      </p>
    </div>
  );
}
