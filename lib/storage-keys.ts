/**
 * Storage keys and upload limits shared by the server and the dashboard.
 * Free of runtime imports, so the browser can check a file before it
 * uploads it.
 *
 * - Images: `2026/<uuid>.webp`, served by /media/[...key]
 * - Product files: `<uuid>.<ext>`, served only through a paid-order download
 *
 * In Vercel Blob they live under `media/` and `files/` of one private store.
 */

export const IMAGE_KINDS = ["avatar", "cover", "thumbnail", "product"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

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

export function isPublicKey(key: string): boolean {
  return PUBLIC_KEY.test(key);
}

export function isPrivateKey(key: string): boolean {
  return PRIVATE_KEY.test(key);
}

export function mediaPathname(key: string): string {
  return `media/${key}`;
}

export function filePathname(key: string): string {
  return `files/${key}`;
}

/** ".zip" for "Template.ZIP"; "" without an extension. */
export function fileExtension(name: string): string {
  const match = /\.[^./\\]+$/.exec(name);
  return match ? match[0].toLowerCase() : "";
}

/** A download name without characters that break headers or paths. */
export function safeFileName(originalName: string, extension: string): string {
  return (
    originalName.replace(/[^\w.\- ()]/g, "_").slice(0, 150) ||
    `produk${extension}`
  );
}

/**
 * True for a pathname the dashboard may upload a product file to directly:
 * `files/<uuid>.<ext>` with an allowed extension.
 */
export function isProductFilePathname(pathname: string): boolean {
  const prefix = "files/";
  if (!pathname.startsWith(prefix)) return false;
  const key = pathname.slice(prefix.length);
  return isPrivateKey(key) && ALLOWED_FILE_EXTENSIONS.has(fileExtension(key));
}
