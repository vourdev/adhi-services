/**
 * Server-side environment, read once and typed. Nothing here is exposed to
 * the browser: none of these names use the NEXT_PUBLIC_ prefix.
 */

const DEV_FALLBACK_URL = "http://localhost:3000";

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * The database: DATABASE_URL, or the TURSO_* variables the Vercel
 * Marketplace Turso integration sets, or a local SQLite file.
 */
export function databaseConfig(): { url: string; authToken?: string } {
  const url =
    read("DATABASE_URL") ?? read("TURSO_DATABASE_URL") ?? "file:./data/app.db";
  const authToken = read("DATABASE_AUTH_TOKEN") ?? read("TURSO_AUTH_TOKEN");
  return authToken ? { url, authToken } : { url };
}

/** Public base URL without a trailing slash, e.g. https://adhinugroho.id */
export function siteUrl(): string {
  const value = read("SITE_URL");
  if (!value) return DEV_FALLBACK_URL;
  return value.replace(/\/+$/, "");
}

/** True when SITE_URL is a real public https origin (needed for payments and indexing). */
export function hasPublicSiteUrl(): boolean {
  const value = read("SITE_URL");
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.includes(".") &&
      !url.hostname.endsWith(".local") &&
      !url.hostname.endsWith(".example")
    );
  } catch {
    return false;
  }
}

const globalForSecret = globalThis as typeof globalThis & {
  __linkbioDevSecret?: string;
};

/**
 * Secret for HMAC-signed download links. Production must set AUTH_SECRET.
 * Development falls back to a random value shared by the whole process
 * (pages and route handlers are separate module instances, so a module
 * variable would not do); signed links then stop working after a restart.
 */
export function authSecret(): string {
  const value = read("AUTH_SECRET");
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET belum diatur (minimal 32 karakter).");
  }
  globalForSecret.__linkbioDevSecret ??=
    crypto.randomUUID() + crypto.randomUUID();
  return globalForSecret.__linkbioDevSecret;
}

export function storageDir(): string {
  return read("STORAGE_DIR") ?? "./storage";
}

/**
 * True when a Vercel Blob store is connected: uploads then go there instead
 * of the local disk. A connected store sets BLOB_STORE_ID (signed in with
 * the deployment's OIDC token); older stores use BLOB_READ_WRITE_TOKEN.
 */
export function blobStorageEnabled(): boolean {
  return Boolean(read("BLOB_STORE_ID") ?? read("BLOB_READ_WRITE_TOKEN"));
}

export type MidtransConfig = {
  serverKey: string;
  isProduction: boolean;
};

export function midtransConfig(): MidtransConfig | null {
  const serverKey = read("MIDTRANS_SERVER_KEY");
  if (!serverKey) return null;
  return { serverKey, isProduction: read("MIDTRANS_IS_PRODUCTION") === "true" };
}

export type EmailConfig = {
  apiKey: string;
  /** Bare address on a domain verified in Resend, e.g. pesanan@domain-anda.id. */
  fromAddress: string;
};

/**
 * Order emails (Resend). Off until both RESEND_API_KEY (set by the Vercel
 * Resend integration) and EMAIL_FROM are configured.
 */
export function emailConfig(): EmailConfig | null {
  const apiKey = read("RESEND_API_KEY");
  const fromAddress = read("EMAIL_FROM");
  if (
    !apiKey ||
    !fromAddress ||
    !/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(fromAddress)
  )
    return null;
  return { apiKey, fromAddress };
}

export const isProduction = process.env.NODE_ENV === "production";
