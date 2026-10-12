import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt. Stored format:
 * scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>
 */
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

function scryptAsync(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: MAX_MEM },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const expected = Buffer.from(hashB64, "base64");
  const key = await scryptAsync(
    password,
    Buffer.from(saltB64, "base64"),
    Number(n),
    Number(r),
    Number(p)
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * A hash of a random password, verified when the email is unknown so a
 * failed sign-in takes the same time whether or not the account exists.
 */
let dummyHash: Promise<string> | undefined;
export function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

/** URL-safe random token, 32 bytes of entropy by default. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Readable order number without ambiguous characters, e.g. LB-7K3Q9X2M. */
export function generateOrderCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `LB-${code}`;
}

/** Signs `payload` with an expiry. Returns query parameters for a URL. */
export function signExpiring(
  secret: string,
  payload: string,
  expiresAtMs: number
): { exp: string; sig: string } {
  const exp = String(Math.floor(expiresAtMs / 1000));
  return { exp, sig: hmacSha256(secret, `${payload}.${exp}`) };
}

export function verifyExpiring(
  secret: string,
  payload: string,
  exp: string | null,
  sig: string | null,
  nowMs = Date.now()
): boolean {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp)) return false;
  if (Number(exp) * 1000 < nowMs) return false;
  return safeEqual(hmacSha256(secret, `${payload}.${exp}`), sig);
}
