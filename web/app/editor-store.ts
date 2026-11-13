/**
 * Draft editor store shared by Customize, Links, Pages, Widgets and Music.
 * - Debounced autosave with optimistic concurrency (rev) — never publishes.
 * - Undo/redo with coalescing of rapid edits to the same setting.
 * - Local backup so a closed tab or failed save can be recovered.
 */
import { useSyncExternalStore } from "react";
import { get, put, post, ApiError } from "./api.ts";
import { defaultConfig, type ProfileConfig } from "../../shared/profile-schema.ts";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

interface State {
  loaded: boolean;
  config: ProfileConfig;
  rev: number;
  serverConfig: ProfileConfig | null;
  publishedConfig: string | null;
  isPublished: boolean;
  publishedVersion: number | null;
  status: SaveStatus;
  error: string | null;
  issues: Record<string, string>;
  premiumBlocked: string[];
  canUndo: boolean;
  canRedo: boolean;
  recovery: { config: ProfileConfig; at: number } | null;
  moderationHidden: boolean;
  userId: string | null;
}

let state: State = {
  loaded: false, config: defaultConfig(), rev: 0, serverConfig: null, publishedConfig: null, isPublished: false, publishedVersion: null,
  status: "idle", error: null, issues: {}, premiumBlocked: [], canUndo: false, canRedo: false, recovery: null, moderationHidden: false, userId: null,
};
const subs = new Set<() => void>();
const emit = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const past: ProfileConfig[] = [];
let future: ProfileConfig[] = [];
let lastKey = "", lastAt = 0, timer: ReturnType<typeof setTimeout> | null = null, inflight: Promise<void> | null = null;
const backupKey = () => `lorn-draft-backup:${state.userId}`;

export function useEditor<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => sel(state), () => sel(state));
}
export const editorState = () => state;

export async function loadEditor(force = false) {
  if (state.loaded && !force) return;
  const e = await get("/api/profile/editor");
  past.length = 0; future = [];
  let recovery: State["recovery"] = null;
  try {
    const b = JSON.parse(localStorage.getItem(`lorn-draft-backup:${e.user.id}`) ?? "null");
    if (b && b.rev === e.rev && JSON.stringify(b.config) !== JSON.stringify(e.draft)) recovery = { config: b.config, at: b.at };
    else localStorage.removeItem(`lorn-draft-backup:${e.user.id}`);
  } catch { /* storage unavailable */ }
  emit({
    loaded: true, config: e.draft, rev: e.rev, serverConfig: e.draft, isPublished: e.isPublished, publishedVersion: e.publishedVersion,
    publishedConfig: e.hasUnpublishedChanges ? "__different__" : JSON.stringify(e.draft), status: "saved", error: null, issues: {},
    premiumBlocked: e.premiumBlocked, canUndo: false, canRedo: false, recovery, moderationHidden: e.moderationHidden, userId: e.user.id,
  });
}

function backup() {
  try { localStorage.setItem(backupKey(), JSON.stringify({ config: state.config, rev: state.rev, at: Date.now() })); } catch { /* quota or private mode */ }
}

/** Apply an edit. `key` groups rapid edits (e.g. a slider drag) into one undo step. */
export function edit(fn: (c: ProfileConfig) => void, key = "") {
  const next = structuredClone(state.config);
  fn(next);
  const now = Date.now();
  if (!(key && key === lastKey && now - lastAt < 800)) { past.push(state.config); if (past.length > 100) past.shift(); }
  lastKey = key; lastAt = now;
  future = [];
  emit({ config: next, status: "dirty", canUndo: past.length > 0, canRedo: false });
  backup();
  schedule();
}

export function setPath(path: string, value: unknown) {
  edit((c) => {
    const parts = path.split(".");
    let o: any = c;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }, path);
}

export function getPath(c: ProfileConfig, path: string): any {
  return path.split(".").reduce((o: any, k) => o?.[k], c);
}

export function resetPath(path: string) { setPath(path, structuredClone(getPath(defaultConfig(), path))); }

export function undo() {
  const prev = past.pop();
  if (!prev) return;
  future.push(state.config);
  lastKey = "";
  emit({ config: prev, status: "dirty", canUndo: past.length > 0, canRedo: true });
  backup(); schedule();
}
export function redo() {
  const next = future.pop();
  if (!next) return;
  past.push(state.config);
  lastKey = "";
  emit({ config: next, status: "dirty", canUndo: true, canRedo: future.length > 0 });
  backup(); schedule();
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { saveNow(); }, 1200);
}

export async function saveNow(): Promise<boolean> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (inflight) await inflight;
  if (state.status !== "dirty" && state.status !== "error") return state.status !== "conflict";
  const sending = state.config;
  emit({ status: "saving" });
  let ok = false;
  inflight = (async () => {
    try {
      const r = await put<{ rev: number; premiumBlocked: string[] }>("/api/profile/draft", { config: sending, rev: state.rev });
      const changedMeanwhile = state.config !== sending;
      emit({ rev: r.rev, serverConfig: sending, status: changedMeanwhile ? "dirty" : "saved", error: null, issues: {}, premiumBlocked: r.premiumBlocked });
      if (!changedMeanwhile) try { localStorage.removeItem(backupKey()); } catch { /* ignore */ }
      else schedule();
      ok = true;
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "draft_conflict") emit({ status: "conflict", error: err.message });
      else emit({ status: "error", error: err.message, issues: err.fieldErrors?.() ?? {} });
    }
  })();
  await inflight;
  inflight = null;
  return ok;
}

export async function publish(note?: string) {
  if (!(await saveNow()) && state.status !== "saved") throw new Error(state.error ?? "Save your changes first");
  const r = await post<{ version: number }>("/api/profile/publish", { note });
  emit({ isPublished: true, publishedVersion: r.version, publishedConfig: JSON.stringify(state.config) });
  return r.version;
}
export async function unpublish() { await post("/api/profile/unpublish"); emit({ isPublished: false }); }
export async function revertToPublished() { await saveNow(); await post("/api/profile/revert"); await loadEditor(true); }
export async function restoreVersion(v: number) { await saveNow(); await post(`/api/profile/versions/${v}/restore`); await loadEditor(true); }
export function acceptRecovery(use: boolean) {
  const r = state.recovery;
  emit({ recovery: null });
  if (use && r) edit((c) => Object.assign(c, r.config));
  else try { localStorage.removeItem(backupKey()); } catch { /* ignore */ }
}
/** Replace local state after a server-side change (template applied). */
export function replaceFromServer(config: ProfileConfig, rev: number) {
  past.push(state.config);
  emit({ config, rev, serverConfig: config, status: "saved", canUndo: true });
}
export const hasUnpublished = (s: State) => s.publishedConfig !== JSON.stringify(s.config);

if (typeof window !== "undefined") {
  addEventListener("beforeunload", (e) => {
    if (state.status === "dirty" || state.status === "saving") { saveNow(); e.preventDefault(); e.returnValue = ""; }
  });
  addEventListener("keydown", (e) => {
    if (!state.loaded || !(e.metaKey || e.ctrlKey) || (e.target as HTMLElement)?.closest?.("input, textarea")) return;
    if (e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if (e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    if (e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(); }
  });
}
