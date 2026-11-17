import type {
  Adapter,
  Finding,
  RunState,
  SourceResult,
  IdentifierType,
} from "../types";
import { eligibleAdapters } from "./registry";

export interface RunnerEvent {
  type: "plan" | "source_start" | "source_done" | "complete" | "error";
  sourceId?: string;
  state?: RunState;
  result?: SourceResult;
  plan?: { sourceId: string; name: string }[];
  message?: string;
}

const PER_SOURCE_TIMEOUT = 25000;

async function runOne(
  adapter: Adapter,
  ctx: {
    input: string;
    identifierType: IdentifierType;
    normalized: string;
    env: Record<string, string | undefined>;
  }
): Promise<SourceResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PER_SOURCE_TIMEOUT);
  try {
    const out = await adapter.run({ ...ctx, signal: ac.signal });
    return {
      sourceId: adapter.meta.id,
      state: out.state,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      findings: out.findings,
      message: out.message,
      raw: out.raw,
    };
  } catch (e: unknown) {
    const err = e as { kind?: string; message?: string };
    const state: RunState =
      err?.kind === "timeout"
        ? "failed"
        : (err?.kind as RunState) || "failed";
    return {
      sourceId: adapter.meta.id,
      state,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      findings: [],
      message: err?.message || "adapter error",
    };
  } finally {
    clearTimeout(timer);
  }
}

// Streaming runner: yields events as each source completes.
export async function* runStream(ctx: {
  input: string;
  identifierType: IdentifierType;
  normalized: string;
  env: Record<string, string | undefined>;
  disabled?: Set<string>;
}): AsyncGenerator<RunnerEvent> {
  const adapters = eligibleAdapters(ctx.identifierType, ctx.normalized, ctx.disabled);
  yield {
    type: "plan",
    plan: adapters.map((a) => ({ sourceId: a.meta.id, name: a.meta.name })),
  };

  // Pushable queue so we can emit results in completion order.
  const queue: RunnerEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let remaining = adapters.length;

  const push = (ev: RunnerEvent) => {
    queue.push(ev);
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  };

  for (const a of adapters) {
    push({ type: "source_start", sourceId: a.meta.id });
    runOne(a, ctx).then((result) => {
      push({ type: "source_done", sourceId: a.meta.id, state: result.state, result });
      remaining--;
      if (remaining === 0) push({ type: "complete" });
    });
  }

  if (adapters.length === 0) {
    yield { type: "complete" };
    return;
  }

  // Drain
  while (true) {
    if (queue.length === 0) {
      await new Promise<void>((r) => (resolveNext = r));
    }
    while (queue.length) {
      const ev = queue.shift()!;
      yield ev;
      if (ev.type === "complete") return;
    }
  }
}

// Non-streaming: run everything, return aggregated results.
export async function runAll(ctx: {
  input: string;
  identifierType: IdentifierType;
  normalized: string;
  env: Record<string, string | undefined>;
  disabled?: Set<string>;
}): Promise<SourceResult[]> {
  const adapters = eligibleAdapters(ctx.identifierType, ctx.normalized, ctx.disabled);
  return Promise.all(adapters.map((a) => runOne(a, ctx)));
}

export function summarize(results: SourceResult[]) {
  const attempted = results.length;
  const completed = results.filter((r) => r.state === "completed").length;
  const noResults = results.filter((r) => r.state === "no_results").length;
  const failed = results.filter((r) =>
    ["failed", "unavailable", "rate_limited", "auth_required"].includes(r.state)
  ).length;
  const allFindings: Finding[] = results.flatMap((r) => r.findings);
  const uniq = new Set(allFindings.map((f) => `${f.key}:${f.value}`));
  return {
    attempted,
    completed,
    noResults,
    failed,
    totalFindings: allFindings.length,
    uniqueFindings: uniq.size,
  };
}
