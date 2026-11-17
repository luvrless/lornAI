// Shared domain types for lorn.lol

export type IdentifierType =
  | "email"
  | "phone"
  | "username"
  | "domain"
  | "ip"
  | "url"
  | "hash"
  | "wallet"
  | "organization"
  | "unknown";

export type SourceStatus =
  | "integrated" // real, keyless, tested
  | "requires_key" // real implementation, needs credentials
  | "public_web" // scrapes/queries a public page
  | "unavailable" // temporarily down
  | "planned"; // registered slot, not yet implemented

export type SourceCategory =
  | "email"
  | "phone"
  | "username"
  | "social"
  | "developer"
  | "breach"
  | "advisory"
  | "threat"
  | "malware"
  | "phishing"
  | "dns"
  | "whois"
  | "certificates"
  | "subdomains"
  | "asn"
  | "ip"
  | "routing"
  | "domain_reputation"
  | "url_reputation"
  | "file_reputation"
  | "hash"
  | "code_search"
  | "repo_search"
  | "org_records"
  | "company_registry"
  | "gov_data"
  | "geo"
  | "maps"
  | "image_meta"
  | "ocr"
  | "video_meta"
  | "web_index"
  | "search_engine"
  | "archive"
  | "news"
  | "forum"
  | "academic"
  | "document_index"
  | "package_registry"
  | "tech_fingerprint"
  | "crypto";

export type PrivacyClass = "public" | "sensitive" | "defensive";

// Per-source execution state during an investigation
export type RunState =
  | "waiting"
  | "running"
  | "completed"
  | "no_results"
  | "rate_limited"
  | "auth_required"
  | "unavailable"
  | "failed";

export interface SourceMeta {
  id: string;
  name: string;
  category: SourceCategory;
  description: string;
  status: SourceStatus;
  supports: IdentifierType[];
  docsUrl?: string;
  authRequired: boolean;
  privacy: PrivacyClass;
  rateLimit?: string;
}

export interface Finding {
  // A normalized atomic fact produced by a source
  key: string; // e.g. "mx_record", "subdomain", "profile"
  label: string; // human label
  value: string; // normalized display value
  entityType?: IdentifierType; // if this finding is itself an identifier (for graphing)
  confidence: number; // 0..1
  sourceId: string;
  sourceUrl?: string;
  collectedAt: string; // ISO
  publishedAt?: string;
  categories?: string[];
  extra?: Record<string, unknown>;
  sensitive?: boolean;
}

export interface SourceResult {
  sourceId: string;
  state: RunState;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  findings: Finding[];
  message?: string; // error / status detail
  raw?: unknown; // permitted raw response (redacted where needed)
}

export interface Investigation {
  id: string;
  userId: string;
  input: string;
  identifierType: IdentifierType;
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
  caseId?: string | null;
  saved?: boolean;
}

export interface AdapterContext {
  input: string;
  identifierType: IdentifierType;
  normalized: string;
  signal: AbortSignal;
  env: Record<string, string | undefined>;
}

export interface Adapter {
  meta: SourceMeta;
  // only run if this returns true for the given identifier
  canRun(ctx: { identifierType: IdentifierType; normalized: string }): boolean;
  run(ctx: AdapterContext): Promise<{
    state: RunState;
    findings: Finding[];
    message?: string;
    raw?: unknown;
  }>;
}

// ---- Persistence models ----

export type Role = "user" | "moderator" | "admin";

export interface User {
  id: string;
  uid: number;        // sequential user number (1 = first ever registration)
  email: string;
  passwordHash: string; // scrypt
  salt: string;
  role: Role;
  createdAt: string;
  verified: boolean;
  suspended?: boolean;
  displayName?: string;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
}

export type CaseStatus = "open" | "in_progress" | "completed" | "archived";

export interface CaseNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface InvestigationCase {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: CaseStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  investigationIds: string[];
  notes: CaseNote[];
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  prefix: string; // visible prefix
  hash: string; // sha256 of full key
  scopes: string[];
  createdAt: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revoked?: boolean;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string | null;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
}
