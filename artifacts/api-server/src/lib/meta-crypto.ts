import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ENC_PREFIX = "enc:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

let _key: Buffer | null = null;

function deriveKey(): Buffer {
  const raw = process.env["META_ENCRYPTION_KEY"];
  if (raw) {
    // Prefer 64-char hex string (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
    const b = Buffer.from(raw, "utf-8");
    if (b.length >= 32) return b.subarray(0, 32);
    // Pad short key via SHA-256
    return createHash("sha256").update(b).digest();
  }
  // Insecure fallback — acceptable for dev; Production MUST set META_ENCRYPTION_KEY
  const seed = process.env["DATABASE_URL"] ?? "castor-meta-catalog-dev-fallback-key-insecure";
  console.warn(
    JSON.stringify({ event: "meta_crypto_no_key", warn: "META_ENCRYPTION_KEY not set — using derived fallback; set a 64-char hex key in production" }),
  );
  return createHash("sha256").update(seed).digest();
}

function key(): Buffer {
  if (!_key) _key = deriveKey();
  return _key;
}

export function isEncrypted(token: string): boolean {
  return token.startsWith(ENC_PREFIX);
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

export function decryptToken(stored: string): string {
  if (!isEncrypted(stored)) {
    // Legacy plaintext — handle gracefully during migration window; never log the value
    console.warn(JSON.stringify({ event: "meta_crypto_legacy_token", warn: "Plaintext access token detected; re-save via POST /api/meta-catalog/config to encrypt" }));
    return stored;
  }
  const parts = stored.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("[meta-crypto] malformed encrypted token — expected enc:iv:tag:ct");
  const [ivHex, tagHex, ctHex] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString("utf-8");
}
