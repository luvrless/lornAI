import { getCurrentUser } from "@/lib/auth";
import { detectIdentifier } from "@/lib/detect";
import { runStream, summarize } from "@/lib/sources/runner";
import { eligiblePlanned, metaById } from "@/lib/sources/registry";
import type { Investigation, SourceResult } from "@/lib/types";
import { uid } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = getCurrentUser();
  if (!session) {
    return new Response(JSON.stringify({ error: "authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: { input?: string; disabled?: string[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid body" }), { status: 400 });
  }
  const input = (body.input || "").trim();
  if (!input) return new Response(JSON.stringify({ error: "input required" }), { status: 400 });

  const det = detectIdentifier(input);
  const disabled = new Set(body.disabled || []);
  const env = process.env as Record<string, string | undefined>;
  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("detected", {
        input,
        identifierType: det.identifierType,
        normalized: det.normalized,
        note: det.note,
      });

      // Report planned/keyed sources that would apply but are skipped
      const planned = eligiblePlanned(det.identifierType)
        .filter((m) => !disabled.has(m.id))
        .map((m) => ({ id: m.id, name: m.name, status: m.status, category: m.category }));
      send("skipped", { planned });

      const results: SourceResult[] = [];
      try {
        for await (const ev of runStream({
          input,
          identifierType: det.identifierType,
          normalized: det.normalized,
          env,
          disabled,
        })) {
          if (ev.type === "plan") {
            send("plan", {
              sources: (ev.plan || []).map((p) => ({
                id: p.sourceId,
                name: p.name,
                meta: metaById(p.sourceId),
              })),
            });
          } else if (ev.type === "source_start") {
            send("source_start", { id: ev.sourceId });
          } else if (ev.type === "source_done" && ev.result) {
            results.push(ev.result);
            send("source_done", { result: ev.result });
          } else if (ev.type === "complete") {
            const stats = summarize(results);
            const investigation: Investigation = {
              id: uid("inv_"),
              userId: session.user.id,
              input,
              identifierType: det.identifierType,
              normalized: det.normalized,
              createdAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              results,
              stats,
              saved: false,
            };
            send("complete", { investigation });
          }
        }
      } catch (e) {
        send("error", { message: (e as Error).message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
