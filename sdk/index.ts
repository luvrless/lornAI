// Minimal TypeScript SDK for the lorn.lol REST API.
// Usage:
//   const lorn = new LornClient({ apiKey: "lorn_sk_...", baseUrl: "http://localhost:3000" });
//   const inv = await lorn.investigate("example.com", { save: true });

export interface LornOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface Finding {
  key: string;
  label: string;
  value: string;
  confidence: number;
  sourceId: string;
  sourceUrl?: string;
  sensitive?: boolean;
}

export interface SourceResult {
  sourceId: string;
  state: string;
  durationMs?: number;
  findings: Finding[];
  message?: string;
}

export interface Investigation {
  id: string;
  input: string;
  identifierType: string;
  normalized: string;
  createdAt: string;
  durationMs?: number;
  results: SourceResult[];
  stats: {
    attempted: number;
    completed: number;
    noResults: number;
    failed: number;
    totalFindings: number;
    uniqueFindings: number;
  };
}

export class LornClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: LornOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || "http://localhost:3000").replace(/\/$/, "");
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data as T;
  }

  async investigate(input: string, opts: { save?: boolean; disabled?: string[] } = {}): Promise<Investigation> {
    const { investigation } = await this.req<{ investigation: Investigation }>(
      "POST",
      "/api/v1/investigations",
      { input, ...opts }
    );
    return investigation;
  }

  async getInvestigation(id: string): Promise<Investigation> {
    const { investigation } = await this.req<{ investigation: Investigation }>("GET", `/api/v1/investigations/${id}`);
    return investigation;
  }

  async listInvestigations(limit = 25, offset = 0) {
    return this.req<{ total: number; investigations: unknown[] }>(
      "GET",
      `/api/v1/investigations?limit=${limit}&offset=${offset}`
    );
  }

  async sources() {
    return this.req<{ stats: Record<string, number>; sources: unknown[] }>("GET", "/api/v1/sources");
  }

  async cases() {
    return this.req<{ cases: unknown[] }>("GET", "/api/v1/cases");
  }
}
