/**
 * Object storage drivers. Local disk for single-server deployments and
 * development; S3-compatible (AWS S3, Cloudflare R2, Backblaze B2, MinIO,
 * Wasabi…) via SigV4 for production. Selected by env vars.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface UploadTarget { url: string; method: "PUT"; headers: Record<string, string> }

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Buffer, mime: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  /** Where the browser uploads bytes directly (S3) or null for the app endpoint (local). */
  presignPut(key: string, mime: string, size: number, expiresSec: number): UploadTarget | null;
  publicUrl(key: string): string;
}

const safeKey = (k: string) => {
  if (!/^[a-z]\/[A-Za-z0-9/_.-]+$/.test(k) || k.includes("..")) throw new Error("invalid storage key");
  return k;
};

export class LocalStorage implements StorageDriver {
  readonly name = "local" as const;
  constructor(private dir: string, private baseUrl: string) { fs.mkdirSync(dir, { recursive: true }); }
  file(key: string) { return path.join(this.dir, safeKey(key)); }
  async put(key: string, body: Buffer) {
    const f = this.file(key);
    await fsp.mkdir(path.dirname(f), { recursive: true });
    await fsp.writeFile(f + ".tmp", body);
    await fsp.rename(f + ".tmp", f);
  }
  /** Stream a request body to disk, aborting past maxBytes. Returns bytes written. */
  async putStream(key: string, src: Readable, maxBytes: number): Promise<number> {
    const f = this.file(key);
    await fsp.mkdir(path.dirname(f), { recursive: true });
    let n = 0;
    const limiter = async function* (s: Readable) {
      for await (const chunk of s) {
        n += (chunk as Buffer).length;
        if (n > maxBytes) throw Object.assign(new Error("too large"), { code: "TOO_LARGE" });
        yield chunk;
      }
    };
    try {
      await pipeline(src, limiter, fs.createWriteStream(f + ".tmp"));
      await fsp.rename(f + ".tmp", f);
    } catch (e) {
      await fsp.rm(f + ".tmp", { force: true });
      throw e;
    }
    return n;
  }
  async read(key: string) { try { return await fsp.readFile(this.file(key)); } catch { return null; } }
  async remove(key: string) { await fsp.rm(this.file(key), { force: true }); }
  presignPut() { return null; }
  publicUrl(key: string) { return `${this.baseUrl}/${key}`; }
}

// ------------------------------------------------------------------ S3 / SigV4

export interface S3Config { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl: string; pathStyle: boolean }

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const sha = (d: string | Buffer) => crypto.createHash("sha256").update(d).digest("hex");
const hm = (k: Buffer | string, d: string) => crypto.createHmac("sha256", k).update(d).digest();

export function sigV4Key(secret: string, date: string, region: string, service = "s3") {
  return hm(hm(hm(hm("AWS4" + secret, date), region), service), "aws4_request");
}

/** Presigned URL (query-string auth), exactly per the AWS SigV4 spec. */
export function presignUrl(o: { method: string; host: string; path: string; region: string; accessKeyId: string; secretAccessKey: string; expires: number; now: Date; headers?: Record<string, string> }) {
  const amz = o.now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amz.slice(0, 8);
  const scope = `${date}/${o.region}/s3/aws4_request`;
  const hdrs: Record<string, string> = { host: o.host, ...Object.fromEntries(Object.entries(o.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])) };
  const signedHeaders = Object.keys(hdrs).sort().join(";");
  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${o.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(o.expires),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const qs = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join("&");
  const canonical = [o.method, o.path.split("/").map(enc).join("/"), qs,
    Object.keys(hdrs).sort().map((k) => `${k}:${hdrs[k].trim()}\n`).join(""), signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(canonical)].join("\n");
  const sig = crypto.createHmac("sha256", sigV4Key(o.secretAccessKey, date, o.region)).update(sts).digest("hex");
  return `${qs}&X-Amz-Signature=${sig}`;
}

export class S3Storage implements StorageDriver {
  readonly name = "s3" as const;
  constructor(private c: S3Config, private fetchFn: typeof fetch = fetch) {}

  private loc(key: string) {
    const u = new URL(this.c.endpoint);
    const base = u.pathname.replace(/\/+$/, ""); // e.g. Supabase: /storage/v1/s3
    return this.c.pathStyle
      ? { host: u.host, path: `${base}/${this.c.bucket}/${safeKey(key)}`, origin: u.origin }
      : { host: `${this.c.bucket}.${u.host}`, path: `/${safeKey(key)}`, origin: `${u.protocol}//${this.c.bucket}.${u.host}` };
  }

  private async signed(method: string, key: string, body?: Buffer, mime?: string) {
    const { host, path: p, origin } = this.loc(key);
    const now = new Date();
    const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const date = amz.slice(0, 8);
    const payloadHash = sha(body ?? "");
    const h: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amz };
    if (mime) h["content-type"] = mime;
    const signedHeaders = Object.keys(h).sort().join(";");
    const canonical = [method, p.split("/").map(enc).join("/"), "", Object.keys(h).sort().map((k) => `${k}:${h[k]}\n`).join(""), signedHeaders, payloadHash].join("\n");
    const scope = `${date}/${this.c.region}/s3/aws4_request`;
    const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(canonical)].join("\n");
    const sig = crypto.createHmac("sha256", sigV4Key(this.c.secretAccessKey, date, this.c.region)).update(sts).digest("hex");
    const { host: _h, ...send } = h;
    return this.fetchFn(origin + p, {
      method, body: body ? new Uint8Array(body) : undefined,
      headers: { ...send, Authorization: `AWS4-HMAC-SHA256 Credential=${this.c.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}` },
      signal: AbortSignal.timeout(60_000),
    });
  }

  async put(key: string, body: Buffer, mime: string) {
    const r = await this.signed("PUT", key, body, mime);
    if (!r.ok) throw new Error(`S3 PUT failed ${r.status}: ${await r.text()}`);
  }
  async read(key: string) {
    const r = await this.signed("GET", key);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`S3 GET failed ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  async remove(key: string) {
    const r = await this.signed("DELETE", key);
    if (!r.ok && r.status !== 404) throw new Error(`S3 DELETE failed ${r.status}`);
  }
  presignPut(key: string, mime: string, _size: number, expiresSec: number): UploadTarget {
    const { host, path: p, origin } = this.loc(key);
    const qs = presignUrl({ method: "PUT", host, path: p, region: this.c.region, accessKeyId: this.c.accessKeyId, secretAccessKey: this.c.secretAccessKey, expires: expiresSec, now: new Date(), headers: { "content-type": mime } });
    return { url: `${origin}${p}?${qs}`, method: "PUT", headers: { "Content-Type": mime } };
  }
  publicUrl(key: string) { return `${this.c.publicBaseUrl.replace(/\/$/, "")}/${key}`; }
}

export function storageFromEnv(appUrl: string): { driver: StorageDriver; status: string } {
  const e = process.env;
  if (e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY && e.S3_ENDPOINT && e.MEDIA_PUBLIC_URL) {
    return {
      driver: new S3Storage({
        endpoint: e.S3_ENDPOINT, region: e.S3_REGION ?? "auto", bucket: e.S3_BUCKET, accessKeyId: e.S3_ACCESS_KEY_ID,
        secretAccessKey: e.S3_SECRET_ACCESS_KEY, publicBaseUrl: e.MEDIA_PUBLIC_URL, pathStyle: e.S3_PATH_STYLE === "true",
      }),
      status: "s3",
    };
  }
  if (e.VERCEL) {
    // Vercel's filesystem is temporary and per-instance: never store uploads there.
    return { driver: new LocalStorage(path.join(os.tmpdir(), "lorn-media"), `${appUrl}/media`), status: "not_configured: set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and MEDIA_PUBLIC_URL" };
  }
  const dir = e.STORAGE_DIR ?? path.resolve("data/media");
  return { driver: new LocalStorage(dir, e.MEDIA_PUBLIC_URL ?? `${appUrl}/media`), status: `local (${dir}); set S3_* + MEDIA_PUBLIC_URL for object storage/CDN` };
}
