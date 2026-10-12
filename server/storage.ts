import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";

import sharp from "sharp";

import { storageDir } from "@/lib/env";

/**
 * Local file storage.
 *
 * - storage/public/  processed images, served by /media/[...key]
 * - storage/private/ product files, served only through a signed,
 *   paid-order download (/api/download/[deliveryId])
 *
 * This needs a persistent disk (a VPS, a container volume). Serverless
 * hosts such as Vercel discard local files; see README "Deploying".
 */

export const IMAGE_KINDS = ["avatar", "cover", "thumbnail", "product"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

const IMAGE_SIZES: Record<
  ImageKind,
  { width: number; height: number; fit: "cover" | "inside" }
> = {
  avatar: { width: 512, height: 512, fit: "cover" },
  cover: { width: 1600, height: 900, fit: "inside" },
  // Large enough for the wide "featured" link card on high-density phones.
  thumbnail: { width: 1200, height: 1200, fit: "inside" },
  product: { width: 1200, height: 1200, fit: "inside" },
};

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_FILE_EXTENSIONS = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".pdf",
  ".epub",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".docx",
  ".xlsx",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp3",
  ".mp4",
]);

const PUBLIC_KEY = /^\d{4}\/[0-9a-f-]{36}\.webp$/;
const PRIVATE_KEY = /^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

function root(...parts: string[]): string {
  return resolve(storageDir(), ...parts);
}

/** Resolves a key inside a storage area, refusing anything that escapes it. */
function safePath(area: "public" | "private", key: string): string | null {
  const base = root(area);
  const target = resolve(base, key);
  return target.startsWith(base + sep) ? target : null;
}

export class StorageError extends Error {}

export async function saveImage(
  input: Buffer,
  kind: ImageKind
): Promise<{ url: string; width: number; height: number }> {
  if (input.byteLength > MAX_IMAGE_BYTES)
    throw new StorageError("Gambar maksimal 8 MB.");
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    throw new StorageError("File bukan gambar yang didukung.");
  }
  if (
    !metadata.format ||
    !["jpeg", "png", "webp", "avif", "gif", "heif"].includes(metadata.format)
  ) {
    throw new StorageError(
      "Format gambar harus JPG, PNG, WebP, AVIF, atau GIF."
    );
  }

  const size = IMAGE_SIZES[kind];
  const { data, info } = await sharp(input, { animated: false })
    .rotate()
    .resize({
      width: size.width,
      height: size.height,
      fit: size.fit,
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const key = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.webp`;
  const path = safePath("public", key);
  if (!path) throw new StorageError("Lokasi penyimpanan tidak valid.");
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, data);
  return { url: `/media/${key}`, width: info.width, height: info.height };
}

export async function openPublicMedia(
  key: string
): Promise<{ stream: ReadableStream; size: number } | null> {
  if (!PUBLIC_KEY.test(key)) return null;
  const path = safePath("public", key);
  if (!path) return null;
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return {
      stream: Readable.toWeb(createReadStream(path)) as ReadableStream,
      size: info.size,
    };
  } catch {
    return null;
  }
}

export function isPrivateKey(key: string): boolean {
  return PRIVATE_KEY.test(key);
}

export async function savePrivateFile(
  input: Buffer,
  originalName: string
): Promise<{ key: string; name: string; size: number }> {
  if (input.byteLength > MAX_FILE_BYTES)
    throw new StorageError("File maksimal 50 MB.");
  const extension = extname(originalName).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    throw new StorageError(
      `Tipe file ${extension || "tanpa ekstensi"} tidak didukung.`
    );
  }
  const key = `${crypto.randomUUID()}${extension}`;
  const path = safePath("private", key);
  if (!path) throw new StorageError("Lokasi penyimpanan tidak valid.");
  await mkdir(root("private"), { recursive: true });
  await writeFile(path, input);
  const name =
    originalName.replace(/[^\w.\- ()]/g, "_").slice(0, 150) ||
    `produk${extension}`;
  return { key, name, size: input.byteLength };
}

export async function privateFileExists(key: string): Promise<boolean> {
  if (!isPrivateKey(key)) return false;
  const path = safePath("private", key);
  if (!path) return false;
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export async function openPrivateFile(
  key: string
): Promise<{ stream: ReadableStream; size: number } | null> {
  if (!isPrivateKey(key)) return null;
  const path = safePath("private", key);
  if (!path) return null;
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return {
      stream: Readable.toWeb(createReadStream(path)) as ReadableStream,
      size: info.size,
    };
  } catch {
    return null;
  }
}

export async function deletePrivateFile(key: string): Promise<void> {
  if (!isPrivateKey(key)) return;
  const path = safePath("private", key);
  if (path) await rm(path, { force: true });
}
