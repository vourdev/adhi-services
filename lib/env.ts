/**
 * Server-side environment, read once and typed. Nothing here is exposed to
 * the browser: none of these names use the NEXT_PUBLIC_ prefix.
 */

const DEV_FALLBACK_URL = "http://localhost:3000";

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function databaseConfig(): { url: string; authToken?: string } {
  const url = read("DATABASE_URL") ?? "file:./data/app.db";
  const authToken = read("DATABASE_AUTH_TOKEN");
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

/**
 * Secret for encrypting the Midtrans server keys members save in Settings.
 * No fallback: a key sealed with a throwaway value would be lost on the
 * next restart. Never change it once keys are stored.
 */
export function encryptionSecret(): string | null {
  const value = read("ENCRYPTION_KEY");
  return value && value.length >= 32 ? value : null;
}

export function storageDir(): string {
  return read("STORAGE_DIR") ?? "./storage";
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

export const isProduction = process.env.NODE_ENV === "production";
