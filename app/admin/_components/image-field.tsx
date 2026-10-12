import { ImageUp, Link2, Trash2 } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type ImageKind = "avatar" | "cover" | "thumbnail" | "product";

export async function uploadFile(
  file: File,
  kind: ImageKind | "product-file"
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", file);
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
      typeof data.error === "string" ? data.error : "Upload gagal."
    );
  return data;
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
