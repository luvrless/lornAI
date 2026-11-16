/** API client: CSRF header, typed errors, upload with real progress. */
let csrf = "";
export const setCsrf = (t: string | undefined) => { if (t) csrf = t; };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) { super(message); }
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) for (const d of this.details) if (d.path && !out[d.path]) out[d.path] = d.message;
    return out;
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "network", "Can't reach LORN.LOL. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("json");
  const data = isJson ? await res.json().catch(() => null) : await res.text();
  // Any /api route on a working server answers JSON. HTML or a bare 404/405 means the request hit a
  // static file host (for example a Pages deployment without the LORN server behind it).
  if (!isJson) {
    throw new ApiError(res.status || 503, "server_unreachable",
      "The LORN.LOL server isn't answering, so sign-up, login and saving don't work right now. The site is only serving its static files. Try again later.");
  }
  if (!res.ok) {
    const e = (data as any)?.error;
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  if (data && typeof data === "object" && typeof (data as any).csrf === "string") setCsrf((data as any).csrf);
  return data as T;
}
export const get = <T = any>(p: string) => api<T>("GET", p);
export const post = <T = any>(p: string, b: unknown = {}) => api<T>("POST", p, b);
export const put = <T = any>(p: string, b: unknown = {}) => api<T>("PUT", p, b);
export const patch = <T = any>(p: string, b: unknown = {}) => api<T>("PATCH", p, b);
export const del = <T = any>(p: string, b: unknown = {}) => api<T>("DELETE", p, b);

export const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export interface UploadedAsset { id: string; kind: string; name: string; mime: string; size: number; url: string; thumbUrl: string | null; width: number | null; height: number | null; durationMs: number | null; folderId: string | null; metadata: any; createdAt: string }

/** start → PUT bytes (XHR for progress) → complete. Works for local and S3 targets. */
export async function uploadFile(file: File, opts: { kind?: string; folderId?: string | null; replaceAssetId?: string; onProgress?: (p: number) => void; startPath?: string; completePath?: (id: string) => string } = {}): Promise<UploadedAsset> {
  if (file.size > 25 * 1024 * 1024) {
    throw new ApiError(400, "file_too_large", "File size exceeds the 25MB limit. Please select a smaller file.");
  }
  const s = await post<{ uploadId: string; target: { url: string; method: string; headers: Record<string, string> } }>(opts.startPath ?? "/api/media/uploads", {
    filename: file.name, mime: file.type || guessMime(file.name), size: file.size, kind: opts.kind, folderId: opts.folderId ?? null, replaceAssetId: opts.replaceAssetId ?? null,
  });
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", s.target.url);
    for (const [k, v] of Object.entries(s.target.headers)) x.setRequestHeader(k, v);
    let lastProgress = 0;
    let lastTime = 0;
    x.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const progress = e.loaded / e.total;
      const now = performance.now();
      if (progress === 1 || progress - lastProgress >= 0.04 || now - lastTime > 120) {
        lastProgress = progress;
        lastTime = now;
        opts.onProgress?.(progress);
      }
    };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new ApiError(x.status, "upload_failed", parseErr(x.responseText) ?? `Upload failed (${x.status})`)));
    x.onerror = () => reject(new ApiError(0, "network", "Upload interrupted. Check your connection and try again."));
    x.send(file);
  });
  opts.onProgress?.(1);
  return post<UploadedAsset>(opts.completePath ? opts.completePath(s.uploadId) : `/api/media/uploads/${s.uploadId}/complete`, {});
}
const parseErr = (t: string) => { try { return JSON.parse(t).error.message; } catch { return null; } };
function guessMime(name: string) {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", flac: "audio/flac", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" } as Record<string, string>)[e] ?? "application/octet-stream";
}

export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);
export const fmtDate = (d: string | Date | null | undefined, time = false) => (d ? new Date(d).toLocaleString("en", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "—");
export const fmtMoney = (cents: number, cur = "usd") => new Intl.NumberFormat("en", { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);
export const ago = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
};
