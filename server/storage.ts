import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";

import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";
import sharp from "sharp";

import { blobStorageEnabled, storageDir } from "@/lib/env";
import {
  ALLOWED_FILE_EXTENSIONS,
  fileExtension,
  filePathname,
  type ImageKind,
  isPrivateKey,
  isPublicKey,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  mediaPathname,
  safeFileName,
} from "@/lib/storage-keys";

export {
  IMAGE_KINDS,
  type ImageKind,
  isPrivateKey,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
} from "@/lib/storage-keys";

/**
 * File storage with two drivers:
 *
 * - Vercel Blob (one private store) when the project has a store connected
 *   (BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN). Serverless hosts discard local
 *   files, so this is what runs on Vercel.
 * - Local disk otherwise (development, a VPS or a container volume):
 *   storage/public/ for images, storage/private/ for product files.
 *
 * Either way images are served by /media/[...key] and product files only
 * through a signed, paid-order download (/api/download/[deliveryId]).
 */

type Area = "public" | "private";
type StoredObject = { stream: ReadableStream; size: number };

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

export class StorageError extends Error {}

function blobPathname(area: Area, key: string): string {
  return area === "public" ? mediaPathname(key) : filePathname(key);
}

function root(...parts: string[]): string {
  return resolve(storageDir(), ...parts);
}

/** Resolves a key inside a storage area, refusing anything that escapes it. */
function safePath(area: Area, key: string): string | null {
  const base = root(area);
  const target = resolve(base, key);
  return target.startsWith(base + sep) ? target : null;
}

async function writeObject(
  area: Area,
  key: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  if (blobStorageEnabled()) {
    await put(blobPathname(area, key), data, {
      access: "private",
      contentType,
      addRandomSuffix: false,
    });
    return;
  }
  const path = safePath(area, key);
  if (!path) throw new StorageError("Lokasi penyimpanan tidak valid.");
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, data);
}

async function readObject(
  area: Area,
  key: string
): Promise<StoredObject | null> {
  if (blobStorageEnabled()) {
    const result = await get(blobPathname(area, key), { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { stream: result.stream, size: result.blob.size };
  }
  const path = safePath(area, key);
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

async function objectExists(area: Area, key: string): Promise<boolean> {
  if (blobStorageEnabled()) {
    try {
      await head(blobPathname(area, key));
      return true;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return false;
      throw error;
    }
  }
  const path = safePath(area, key);
  if (!path) return false;
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function deleteObject(area: Area, key: string): Promise<void> {
  if (blobStorageEnabled()) {
    await del(blobPathname(area, key));
    return;
  }
  const path = safePath(area, key);
  if (path) await rm(path, { force: true });
}

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
  await writeObject("public", key, data, "image/webp");
  return { url: `/media/${key}`, width: info.width, height: info.height };
}

export async function openPublicMedia(
  key: string
): Promise<StoredObject | null> {
  if (!isPublicKey(key)) return null;
  return readObject("public", key);
}

export async function savePrivateFile(
  input: Buffer,
  originalName: string
): Promise<{ key: string; name: string; size: number }> {
  if (input.byteLength > MAX_FILE_BYTES)
    throw new StorageError("File maksimal 50 MB.");
  const extension = fileExtension(originalName);
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    throw new StorageError(
      `Tipe file ${extension || "tanpa ekstensi"} tidak didukung.`
    );
  }
  const key = `${crypto.randomUUID()}${extension}`;
  await writeObject("private", key, input, "application/octet-stream");
  return {
    key,
    name: safeFileName(originalName, extension),
    size: input.byteLength,
  };
}

export async function privateFileExists(key: string): Promise<boolean> {
  if (!isPrivateKey(key)) return false;
  return objectExists("private", key);
}

export async function openPrivateFile(
  key: string
): Promise<StoredObject | null> {
  if (!isPrivateKey(key)) return null;
  return readObject("private", key);
}

export async function deletePrivateFile(key: string): Promise<void> {
  if (!isPrivateKey(key)) return;
  await deleteObject("private", key);
}
