import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Encrypts small secrets for storage in the database (AES-256-GCM). The key
 * is derived from a server secret (ENCRYPTION_KEY). `context` is bound to
 * the ciphertext, so a value copied to another row does not decrypt.
 *
 * Format: v1.<iv>.<ciphertext>.<tag>, each part base64url.
 */

const VERSION = "v1";
const TAG_LENGTH = 16;

function deriveKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", secret, "", "linkbio:secret-box:v1", 32)
  );
}

export function sealSecret(
  plaintext: string,
  context: string,
  secret: string
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv, {
    authTagLength: TAG_LENGTH,
  });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    body.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

/** The plaintext, or null when the value is malformed, tampered with, or sealed with another key. */
export function openSecret(
  sealed: string,
  context: string,
  secret: string
): string | null {
  const [version, iv, body, tag, extra] = sealed.split(".");
  if (version !== VERSION || !iv || !body || !tag || extra !== undefined)
    return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret),
      Buffer.from(iv, "base64url"),
      { authTagLength: TAG_LENGTH }
    );
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
