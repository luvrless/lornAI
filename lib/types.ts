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
  | "integrated"
  | "requires_key"
  | "public_web"
  | "unavailable"
  | "planned";

export type SourceCategory =
  | "email" | "phone" | "username" | "social" | "developer" | "breach"
  | "advisory" | "threat" | "malware" | "phishing" | "dns" | "whois"
  | "certificates" | "subdomains" | "asn" | "ip" | "routing"
  | "domain_reputation" | "url_reputation" | "file_reputation" | "hash"
  | "code_search" | "repo_search" | "org_records" | "company_registry"
  | "gov_data" | "geo" | "maps" | "image_meta" | "ocr" | "video_meta"
  | "web_index" | "search_engine" | "archive" | "news" | "forum"
  | "academic" | "document_index" | "package_registry" | "tech_fingerprint" | "crypto";

export type PrivacyClass = "public" | "sensitive" | "defensive";
export type RunState = "waiting" | "running" | "completed" | "no_results" | "rate_limited" | "auth_required" | "unavailable" | "failed";

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
  key: string;
  label: string;
  value: string;
  entityType?: IdentifierType;
  confidence: number;
  sourceId: string;
  sourceUrl?: string;
  collectedAt: string;
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
  message?: string;
  raw?: unknown;
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
  stats: { attempted: number; completed: number; noResults: number; failed: number; totalFindings: number; uniqueFindings: number };
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
  canRun(ctx: { identifierType: IdentifierType; normalized: string }): boolean;
  run(ctx: AdapterContext): Promise<{ state: RunState; findings: Finding[]; message?: string; raw?: unknown }>;
}

export type Role = "user" | "moderator" | "admin";

export interface User {
  id: string;
  uid: number;
  email: string;
  passwordHash: string;
  salt: string;
  role: Role;
  createdAt: string;
  verified: boolean;
  suspended?: boolean;
  displayName?: string;
  guest?: boolean;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
}

export type CaseStatus = "open" | "in_progress" | "completed" | "archived";
export interface CaseNote { id: string; body: string; createdAt: string }
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
  prefix: string;
  hash: string;
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
