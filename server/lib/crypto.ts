import crypto from "node:crypto";

/** 256-bit URL-safe random token. */
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

/** Tokens are stored only as SHA-256 hashes. */
export const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest();

export const hmac = (key: Buffer, data: string) => crypto.createHmac("sha256", key).update(data).digest("base64url");

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** AES-256-GCM for secrets at rest (OAuth tokens, TOTP seeds). */
export function encrypt(key: Buffer, plaintext: string): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), ct]);
}

export function decrypt(key: Buffer, blob: Buffer): string {
  if (blob[0] !== 1) throw new Error("unknown ciphertext version");
  const iv = blob.subarray(1, 13), tag = blob.subarray(13, 29), ct = blob.subarray(29);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// ------------------------------------------------------------------ TOTP (RFC 6238)
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function totp(secret: Buffer, time = Date.now(), step = 30, digits = 6): string {
  const counter = Math.floor(time / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", secret).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const code = (h.readUInt32BE(off) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, "0");
}

/** Accepts the current step and ±1 for clock skew. */
export function verifyTotp(secret: Buffer, code: string, time = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((d) => safeEqual(totp(secret, time + d * 30_000), code));
}
