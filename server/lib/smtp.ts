/**
 * Minimal SMTP client: implicit TLS (smtps://, port 465) or STARTTLS
 * (smtp://, upgraded when offered; required unless ?insecure=1), AUTH PLAIN
 * or LOGIN, dot-stuffed DATA. Used by the email outbox worker.
 */
import net from "node:net";
import tls from "node:tls";
import crypto from "node:crypto";

export interface Mail { from: string; to: string; subject: string; text: string; html?: string }

class Conn {
  private buf = "";
  private waiters: ((l: string[]) => void)[] = [];
  constructor(public sock: net.Socket | tls.TLSSocket) { this.attach(sock); }
  attach(s: net.Socket | tls.TLSSocket) {
    this.sock = s;
    s.on("data", (d: Buffer) => {
      this.buf += d.toString("utf8");
      let lines: string[] = [];
      for (;;) {
        const i = this.buf.indexOf("\r\n");
        if (i < 0) break;
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        lines.push(line);
        if (/^\d{3} /.test(line)) { this.waiters.shift()?.(lines); lines = []; }
      }
      if (lines.length) this.buf = lines.map((l) => l + "\r\n").join("") + this.buf;
    });
  }
  read(): Promise<string[]> { return new Promise((r, j) => { this.waiters.push(r); this.sock.once("error", j); }); }
  async cmd(line: string | null, expect: number[]) {
    const p = this.read();
    if (line !== null) this.sock.write(line + "\r\n");
    const lines = await p;
    const code = Number(lines[lines.length - 1].slice(0, 3));
    if (!expect.includes(code)) throw new Error(`SMTP ${line?.split(" ")[0] ?? "greeting"} failed: ${lines.join(" | ")}`);
    return lines;
  }
}

const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);
const addr = (s: string) => /<([^>]+)>/.exec(s)?.[1] ?? s.trim();

export async function sendMail(url: string, m: Mail): Promise<string> {
  const u = new URL(url);
  const implicit = u.protocol === "smtps:";
  const port = Number(u.port || (implicit ? 465 : 587));
  const insecure = u.searchParams.get("insecure") === "1";
  const sock: net.Socket = await new Promise((res, rej) => {
    const s = implicit ? tls.connect({ host: u.hostname, port, servername: u.hostname }) : net.connect(port, u.hostname);
    s.once(implicit ? "secureConnect" : "connect", () => res(s));
    s.once("error", rej);
    s.setTimeout(20_000, () => s.destroy(new Error("SMTP timeout")));
  });
  const c = new Conn(sock);
  try {
    await c.cmd(null, [220]);
    let ehlo = await c.cmd("EHLO lorn.lol", [250]);
    if (!implicit) {
      if (ehlo.some((l) => /STARTTLS/i.test(l))) {
        await c.cmd("STARTTLS", [220]);
        const secure: tls.TLSSocket = await new Promise((res, rej) => {
          const t = tls.connect({ socket: sock, servername: u.hostname }, () => res(t));
          t.once("error", rej);
        });
        c.attach(secure);
        ehlo = await c.cmd("EHLO lorn.lol", [250]);
      } else if (!insecure) throw new Error("SMTP server does not offer STARTTLS (add ?insecure=1 only for local relays)");
    }
    const user = decodeURIComponent(u.username), pass = decodeURIComponent(u.password);
    if (user) {
      if (ehlo.some((l) => /AUTH.*PLAIN/i.test(l))) await c.cmd(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString("base64")}`, [235]);
      else {
        await c.cmd("AUTH LOGIN", [334]);
        await c.cmd(Buffer.from(user).toString("base64"), [334]);
        await c.cmd(Buffer.from(pass).toString("base64"), [235]);
      }
    }
    await c.cmd(`MAIL FROM:<${addr(m.from)}>`, [250]);
    await c.cmd(`RCPT TO:<${addr(m.to)}>`, [250, 251]);
    await c.cmd("DATA", [354]);
    const id = `<${crypto.randomUUID()}@lorn.lol>`;
    const b64 = (t: string) => Buffer.from(t.replace(/\r?\n/g, "\r\n")).toString("base64").replace(/.{76}/g, "$&\r\n");
    const head = [`From: ${m.from}`, `To: ${m.to}`, `Subject: ${encodeHeader(m.subject)}`, `Date: ${new Date().toUTCString()}`, `Message-ID: ${id}`, "MIME-Version: 1.0"];
    let parts: string[];
    if (m.html) {
      // multipart/alternative: plain text first, HTML last (clients show the last part they can render).
      const boundary = `lorn-${crypto.randomUUID()}`;
      parts = [...head, `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
        `--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(m.text),
        `--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(m.html),
        `--${boundary}--`];
    } else {
      parts = [...head, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(m.text)];
    }
    const msg = parts.join("\r\n").replace(/^\./gm, "..");
    await c.cmd(`${msg}\r\n.`, [250]);
    await c.cmd("QUIT", [221]).catch(() => {});
    return id;
  } finally {
    c.sock.destroy();
  }
}
