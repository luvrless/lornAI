/**
 * Minimal, dependency-free PostgreSQL client.
 *
 * - Protocol v3, extended query protocol for every parameterised query
 *   (values travel separately from SQL text, so no string-built SQL).
 * - Auth: trust, cleartext, MD5, SCRAM-SHA-256.
 * - Optional TLS (SSLRequest) for managed databases.
 * - Pool with bounded size, waiter queue, idle eviction and transactions.
 */
import net from "node:net";
import tls from "node:tls";
import crypto from "node:crypto";

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean | tls.ConnectionOptions;
  max?: number;
  idleTimeoutMs?: number;
  statementTimeoutMs?: number;
}

export interface QueryResult<R = any> {
  rows: R[];
  rowCount: number;
  command: string;
  fields: { name: string; typeOid: number }[];
}

export class PgError extends Error {
  code: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
  severity?: string;
  constructor(fields: Record<string, string>) {
    super(fields.M ?? "PostgreSQL error");
    this.name = "PgError";
    this.code = fields.C ?? "XX000";
    this.detail = fields.D;
    this.constraint = fields.n;
    this.table = fields.t;
    this.column = fields.c;
    this.severity = fields.S;
  }
}

/** Mark a value to be sent as JSON even if it is an array. */
export class JsonParam {
  constructor(public value: unknown) {}
}
export const asJson = (v: unknown) => new JsonParam(v);

// ---------------------------------------------------------------- encoding

function escapeArrayElem(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  const s = typeof v === "string" ? v : String(v);
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export function serializeParam(v: unknown): Buffer | null {
  if (v === null || v === undefined) return null;
  if (v instanceof JsonParam) return Buffer.from(JSON.stringify(v.value), "utf8");
  if (Buffer.isBuffer(v)) return Buffer.from("\\x" + v.toString("hex"), "utf8");
  if (v instanceof Date) return Buffer.from(v.toISOString(), "utf8");
  if (Array.isArray(v)) return Buffer.from("{" + v.map(escapeArrayElem).join(",") + "}", "utf8");
  if (typeof v === "object") return Buffer.from(JSON.stringify(v), "utf8");
  if (typeof v === "boolean") return Buffer.from(v ? "t" : "f", "utf8");
  return Buffer.from(String(v), "utf8");
}

function parseArray(text: string, elem: (s: string) => unknown): unknown[] {
  // Handles one-dimensional arrays, quoted elements and NULLs.
  const out: unknown[] = [];
  if (text === "{}") return out;
  let i = 1;
  while (i < text.length - 1) {
    let val: string | null;
    if (text[i] === '"') {
      i++;
      let s = "";
      while (text[i] !== '"') {
        if (text[i] === "\\") i++;
        s += text[i++];
      }
      i++;
      val = s;
    } else {
      let j = i;
      while (j < text.length - 1 && text[j] !== ",") j++;
      const raw = text.slice(i, j);
      val = raw === "NULL" ? null : raw;
      i = j;
    }
    out.push(val === null ? null : elem(val));
    if (text[i] === ",") i++;
  }
  return out;
}

const int8 = (s: string) => {
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : s;
};

const parsers: Record<number, (s: string) => unknown> = {
  16: (s) => s === "t",
  17: (s) => Buffer.from(s.slice(2), "hex"),
  20: int8,
  21: Number,
  23: Number,
  26: Number,
  700: Number,
  701: Number,
  114: JSON.parse,
  3802: JSON.parse,
  1114: (s) => new Date(s + "Z"),
  1184: (s) => new Date(s),
  1000: (s) => parseArray(s, (x) => x === "t"),
  1005: (s) => parseArray(s, Number),
  1007: (s) => parseArray(s, Number),
  1016: (s) => parseArray(s, int8),
  1009: (s) => parseArray(s, (x) => x),
  1015: (s) => parseArray(s, (x) => x),
  2951: (s) => parseArray(s, (x) => x),
};

// ---------------------------------------------------------------- writer

class Writer {
  private parts: Buffer[] = [];
  private size = 0;
  byte(n: number) { return this.push(Buffer.from([n])); }
  int16(n: number) { const b = Buffer.alloc(2); b.writeInt16BE(n); return this.push(b); }
  int32(n: number) { const b = Buffer.alloc(4); b.writeInt32BE(n); return this.push(b); }
  cstr(s: string) { return this.push(Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])])); }
  bytes(b: Buffer) { return this.push(b); }
  private push(b: Buffer) { this.parts.push(b); this.size += b.length; return this; }
  /** Frame as a typed protocol message. */
  msg(type: string): Buffer {
    const body = Buffer.concat(this.parts);
    const head = Buffer.alloc(5);
    head.write(type, 0, "ascii");
    head.writeInt32BE(body.length + 4, 1);
    return Buffer.concat([head, body]);
  }
  /** Frame without a type byte (startup / SSL request). */
  raw(): Buffer {
    const body = Buffer.concat(this.parts);
    const head = Buffer.alloc(4);
    head.writeInt32BE(body.length + 4);
    return Buffer.concat([head, body]);
  }
}

// ---------------------------------------------------------------- connection

interface Pending {
  resolve: (r: QueryResult[]) => void;
  reject: (e: Error) => void;
  results: QueryResult[];
  current: QueryResult | null;
  error: PgError | null;
}

export class Connection {
  private sock!: net.Socket | tls.TLSSocket;
  private buf: Buffer = Buffer.alloc(0);
  private queue: Pending[] = [];
  private onAuth?: { resolve: () => void; reject: (e: Error) => void };
  private scram?: { nonce: string; clientFirstBare: string; password: string; serverSig?: Buffer };
  closed = false;
  lastUsed = Date.now();
  inTx = false;

  constructor(private cfg: PgConfig) {}

  async connect(): Promise<void> {
    let sock: net.Socket = await new Promise((res, rej) => {
      const s = net.connect(this.cfg.port, this.cfg.host);
      s.once("connect", () => res(s));
      s.once("error", rej);
    });
    if (this.cfg.ssl) {
      sock.write(new Writer().int32(80877103).raw());
      const answer: Buffer = await new Promise((res) => sock.once("data", res));
      if (answer[0] !== 0x53) throw new Error("Server refused TLS");
      const opts = typeof this.cfg.ssl === "object" ? this.cfg.ssl : {};
      sock = tls.connect({ socket: sock, servername: this.cfg.host, ...opts });
      await new Promise<void>((res, rej) => { sock.once("secureConnect", () => res()); sock.once("error", rej); });
    }
    this.sock = sock;
    sock.setNoDelay(true);
    sock.on("data", (d: Buffer) => this.onData(d));
    sock.on("error", (e) => this.fail(e));
    sock.on("close", () => this.fail(new Error("Connection closed")));

    const w = new Writer().int32(196608)
      .cstr("user").cstr(this.cfg.user)
      .cstr("database").cstr(this.cfg.database)
      .cstr("client_encoding").cstr("UTF8")
      .cstr("application_name").cstr("lorn");
    w.byte(0);
    await new Promise<void>((resolve, reject) => {
      this.onAuth = { resolve, reject };
      sock.write(w.raw());
    });
    if (this.cfg.statementTimeoutMs) {
      await this.simple(`SET statement_timeout = ${Math.floor(this.cfg.statementTimeoutMs)}`);
    }
  }

  private fail(e: Error) {
    if (this.closed) return;
    this.closed = true;
    this.onAuth?.reject(e);
    for (const p of this.queue.splice(0)) p.reject(e);
  }

  close() {
    if (this.closed) return;
    try { this.sock.write(new Writer().msg("X")); } catch {}
    this.sock.end();
    this.closed = true;
  }

  private onData(d: Buffer) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const type = String.fromCharCode(this.buf[0]);
      const body = this.buf.subarray(5, len + 1);
      this.buf = this.buf.subarray(len + 1);
      try { this.handle(type, body); } catch (e) { this.fail(e as Error); }
    }
  }

  private handle(type: string, body: Buffer) {
    switch (type) {
      case "R": return this.handleAuth(body);
      case "S": case "K": case "N": case "A": return;
      case "E": {
        const err = new PgError(parseFields(body));
        if (this.onAuth) { const a = this.onAuth; this.onAuth = undefined; a.reject(err); return; }
        const p = this.queue[0];
        if (p) p.error = err;
        return;
      }
      case "Z": {
        this.inTx = body[0] !== 0x49; // 'I' = idle
        if (this.onAuth) { const a = this.onAuth; this.onAuth = undefined; a.resolve(); return; }
        const p = this.queue.shift();
        if (!p) return;
        if (p.error) p.reject(p.error); else p.resolve(p.results);
        return;
      }
      case "1": case "2": case "3": case "n": case "s": return;
      case "T": {
        const p = this.queue[0];
        const n = body.readInt16BE(0);
        let off = 2;
        const fields = [];
        for (let i = 0; i < n; i++) {
          const end = body.indexOf(0, off);
          const name = body.toString("utf8", off, end);
          off = end + 1;
          const typeOid = body.readInt32BE(off + 6);
          off += 18;
          fields.push({ name, typeOid });
        }
        p.current = { rows: [], rowCount: 0, command: "", fields };
        return;
      }
      case "D": {
        const p = this.queue[0];
        const cur = p.current!;
        const n = body.readInt16BE(0);
        let off = 2;
        const row: Record<string, unknown> = {};
        for (let i = 0; i < n; i++) {
          const len = body.readInt32BE(off);
          off += 4;
          const f = cur.fields[i];
          if (len === -1) { row[f.name] = null; continue; }
          const s = body.toString("utf8", off, off + len);
          off += len;
          const parse = parsers[f.typeOid];
          row[f.name] = parse ? parse(s) : s;
        }
        cur.rows.push(row);
        return;
      }
      case "C": {
        const p = this.queue[0];
        const tag = body.toString("utf8", 0, body.length - 1);
        const cur = p.current ?? { rows: [], rowCount: 0, command: "", fields: [] };
        cur.command = tag.split(" ")[0];
        const last = Number(tag.split(" ").pop());
        cur.rowCount = Number.isFinite(last) ? last : cur.rows.length;
        p.results.push(cur);
        p.current = null;
        return;
      }
      case "I": {
        this.queue[0]?.results.push({ rows: [], rowCount: 0, command: "", fields: [] });
        return;
      }
      default:
        return;
    }
  }

  private handleAuth(body: Buffer) {
    const code = body.readInt32BE(0);
    const pw = this.cfg.password ?? "";
    if (code === 0) return;
    if (code === 3) { this.sock.write(new Writer().cstr(pw).msg("p")); return; }
    if (code === 5) {
      const salt = body.subarray(4, 8);
      const inner = crypto.createHash("md5").update(pw + this.cfg.user).digest("hex");
      const outer = crypto.createHash("md5").update(Buffer.concat([Buffer.from(inner), salt])).digest("hex");
      this.sock.write(new Writer().cstr("md5" + outer).msg("p"));
      return;
    }
    if (code === 10) {
      const mechs = body.toString("utf8", 4).split("\0");
      if (!mechs.includes("SCRAM-SHA-256")) throw new Error("No supported SASL mechanism");
      const nonce = crypto.randomBytes(18).toString("base64");
      const clientFirstBare = `n=*,r=${nonce}`;
      this.scram = { nonce, clientFirstBare, password: pw };
      const data = Buffer.from("n,," + clientFirstBare, "utf8");
      this.sock.write(new Writer().cstr("SCRAM-SHA-256").int32(data.length).bytes(data).msg("p"));
      return;
    }
    if (code === 11) {
      const s = this.scram!;
      const serverFirst = body.toString("utf8", 4);
      const attrs = Object.fromEntries(serverFirst.split(",").map((kv) => [kv[0], kv.slice(2)]));
      if (!attrs.r.startsWith(s.nonce)) throw new Error("SCRAM nonce mismatch");
      const salted = crypto.pbkdf2Sync(s.password.normalize("NFKC"), Buffer.from(attrs.s, "base64"), Number(attrs.i), 32, "sha256");
      const clientKey = hmac(salted, "Client Key");
      const storedKey = crypto.createHash("sha256").update(clientKey).digest();
      const finalNoProof = `c=biws,r=${attrs.r}`;
      const authMessage = `${s.clientFirstBare},${serverFirst},${finalNoProof}`;
      const clientSig = hmac(storedKey, authMessage);
      const proof = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) proof[i] = clientKey[i] ^ clientSig[i];
      s.serverSig = hmac(hmac(salted, "Server Key"), authMessage);
      this.sock.write(new Writer().bytes(Buffer.from(`${finalNoProof},p=${proof.toString("base64")}`)).msg("p"));
      return;
    }
    if (code === 12) {
      const v = body.toString("utf8", 4).split(",").find((x) => x.startsWith("v="));
      const sig = Buffer.from(v!.slice(2), "base64");
      if (!this.scram?.serverSig || !crypto.timingSafeEqual(sig, this.scram.serverSig)) {
        throw new Error("SCRAM server signature mismatch");
      }
      return;
    }
    throw new Error(`Unsupported auth method ${code}`);
  }

  private enqueue(buf: Buffer): Promise<QueryResult[]> {
    if (this.closed) return Promise.reject(new Error("Connection closed"));
    this.lastUsed = Date.now();
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, results: [], current: null, error: null });
      this.sock.write(buf);
    });
  }

  /** Simple-protocol query. Only for trusted, static SQL (migrations, SET). */
  async simple(sql: string): Promise<QueryResult[]> {
    return this.enqueue(new Writer().cstr(sql).msg("Q"));
  }

  async query<R = any>(sql: string, params: unknown[] = []): Promise<QueryResult<R>> {
    const parse = new Writer().cstr("").cstr(sql).int16(0).msg("P");
    const bind = new Writer().cstr("").cstr("").int16(0).int16(params.length);
    for (const p of params) {
      const b = serializeParam(p);
      if (b === null) bind.int32(-1); else bind.int32(b.length).bytes(b);
    }
    bind.int16(0);
    const out = Buffer.concat([
      parse,
      bind.msg("B"),
      new Writer().byte(0x50).cstr("").msg("D"),
      new Writer().cstr("").int32(0).msg("E"),
      new Writer().msg("S"),
    ]);
    const res = await this.enqueue(out);
    return (res[0] ?? { rows: [], rowCount: 0, command: "", fields: [] }) as QueryResult<R>;
  }
}

function hmac(key: Buffer, data: string) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function parseFields(body: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let off = 0;
  while (off < body.length && body[off] !== 0) {
    const code = String.fromCharCode(body[off]);
    const end = body.indexOf(0, off + 1);
    out[code] = body.toString("utf8", off + 1, end);
    off = end + 1;
  }
  return out;
}

// ---------------------------------------------------------------- pool

export interface Queryable {
  query<R = any>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
}

export class Pool implements Queryable {
  private idle: Connection[] = [];
  private total = 0;
  private waiters: ((c: Connection) => void)[] = [];
  private timer: NodeJS.Timeout;
  private ended = false;

  constructor(private cfg: PgConfig) {
    this.timer = setInterval(() => this.evict(), 10_000);
    this.timer.unref();
  }

  get stats() {
    return { total: this.total, idle: this.idle.length, waiting: this.waiters.length };
  }

  private evict() {
    const cutoff = Date.now() - (this.cfg.idleTimeoutMs ?? 30_000);
    this.idle = this.idle.filter((c) => {
      if (c.lastUsed < cutoff && this.total > 1) { c.close(); this.total--; return false; }
      return true;
    });
  }

  async acquire(): Promise<Connection> {
    if (this.ended) throw new Error("Pool has ended");
    while (this.idle.length) {
      const c = this.idle.pop()!;
      if (!c.closed) return c;
      this.total--;
    }
    if (this.total < (this.cfg.max ?? 10)) {
      this.total++;
      const c = new Connection(this.cfg);
      try { await c.connect(); } catch (e) { this.total--; throw e; }
      return c;
    }
    return new Promise((res) => this.waiters.push(res));
  }

  release(c: Connection) {
    if (c.closed || c.inTx) {
      // Never hand out a connection stuck in a transaction.
      c.close();
      this.total--;
      if (this.waiters.length) this.acquire().then(this.waiters.shift()!).catch(() => {});
      return;
    }
    const w = this.waiters.shift();
    if (w) w(c); else this.idle.push(c);
  }

  async query<R = any>(sql: string, params: unknown[] = []): Promise<QueryResult<R>> {
    const c = await this.acquire();
    try { return await c.query<R>(sql, params); } finally { this.release(c); }
  }

  /**
   * Run fn inside a transaction. Serialization failures and deadlocks are
   * retried, so fn must be safe to re-run (it only touches the DB through tx).
   */
  async tx<T>(fn: (tx: Queryable) => Promise<T>, opts: { isolation?: "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE"; retries?: number } = {}): Promise<T> {
    const retries = opts.retries ?? 3;
    for (let attempt = 0; ; attempt++) {
      const c = await this.acquire();
      try {
        await c.simple(`BEGIN ISOLATION LEVEL ${opts.isolation ?? "READ COMMITTED"}`);
        const result = await fn(c);
        await c.simple("COMMIT");
        return result;
      } catch (e) {
        try { if (!c.closed) await c.simple("ROLLBACK"); } catch {}
        const code = (e as PgError).code;
        if ((code === "40001" || code === "40P01") && attempt < retries) continue;
        throw e;
      } finally {
        this.release(c);
      }
    }
  }

  async end() {
    this.ended = true;
    clearInterval(this.timer);
    for (const c of this.idle) c.close();
    this.idle = [];
  }
}

export function configFromUrl(url: string, extra: Partial<PgConfig> = {}): PgConfig {
  const u = new URL(url);
  const sslmode = u.searchParams.get("sslmode");
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    ssl: sslmode === "require" || sslmode === "verify-full" ? (sslmode === "require" ? { rejectUnauthorized: false } : true) : false,
    ...extra,
  };
}
