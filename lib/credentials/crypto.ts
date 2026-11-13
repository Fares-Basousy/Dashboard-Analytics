import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM sealing for the credentials cookie. httpOnly already keeps the cookie away from
 * browser JavaScript; encryption additionally makes a leaked cookie value useless.
 * Format: base64url(iv[12] | authTag[16] | ciphertext).
 */

const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

function key(): Buffer {
  const secret = process.env.CREDENTIALS_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("CREDENTIALS_SECRET must be set in production (generate one with `openssl rand -base64 32`).");
  }
  return createHash("sha256").update(secret || DEV_FALLBACK_SECRET).digest();
}

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Returns null for tampered, corrupted or foreign-key values instead of throwing. */
export function unseal(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
