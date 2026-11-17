import { getCurrentUser } from "@/lib/auth";
import { checkPasswordExposure } from "@/lib/sources/pwned";
import { json, err } from "@/lib/apiutil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Privacy-preserving: the password is hashed server-side; only a 5-char SHA-1
// prefix is sent to the range API. The password is never stored or logged.
export async function POST(req: Request) {
  if (!getCurrentUser()) return err("authentication required", 401);
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return err("invalid body");
  }
  const password = body.password || "";
  if (!password) return err("password required");
  try {
    const result = await checkPasswordExposure(password);
    return json({
      exposed: result.exposed,
      count: result.count,
      method: "HIBP Pwned Passwords k-anonymity (SHA-1 range)",
      advice: result.exposed
        ? "This password appears in known breach corpora. Do not use it; choose a unique passphrase and enable 2FA."
        : "Not found in the Pwned Passwords dataset. Still use a unique password per site.",
    });
  } catch (e) {
    return err((e as Error).message || "lookup failed", 502);
  }
}
