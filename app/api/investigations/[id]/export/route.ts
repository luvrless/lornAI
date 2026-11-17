import { db } from "@/lib/db";
import { requireUser, isUser, err } from "@/lib/apiutil";
import { reportJSON, reportCSV } from "@/lib/report";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const inv = db.find("investigations", (i) => i.id === params.id && i.userId === u.id);
  if (!inv) return err("not found", 404);
  const format = new URL(req.url).searchParams.get("format") || "json";
  if (format === "csv") {
    return new Response(reportCSV(inv), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="lorn-${inv.id}.csv"`,
      },
    });
  }
  return new Response(reportJSON(inv), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="lorn-${inv.id}.json"`,
    },
  });
}
