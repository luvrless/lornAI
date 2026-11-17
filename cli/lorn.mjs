#!/usr/bin/env node
// lorn.lol CLI — thin wrapper over the REST API.
//   LORN_API_KEY=lorn_sk_... node cli/lorn.mjs investigate example.com
//   LORN_BASE_URL=http://localhost:3000 node cli/lorn.mjs sources

const API_KEY = process.env.LORN_API_KEY;
const BASE = (process.env.LORN_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

function die(msg) {
  console.error(`lorn: ${msg}`);
  process.exit(1);
}

async function req(method, path, body) {
  if (!API_KEY) die("set LORN_API_KEY");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${API_KEY}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) die(data.error || `HTTP ${res.status}`);
  return data;
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "investigate": {
    const input = args[0];
    if (!input) die("usage: investigate <identifier> [--save]");
    const save = args.includes("--save");
    const { investigation } = await req("POST", "/api/v1/investigations", { input, save });
    console.log(`\n${investigation.identifierType.toUpperCase()}: ${investigation.normalized}`);
    console.log(`Sources: ${investigation.stats.completed}/${investigation.stats.attempted} with data · ${investigation.stats.uniqueFindings} unique findings\n`);
    for (const r of investigation.results) {
      console.log(`  [${r.state}] ${r.sourceId}${r.message ? ` — ${r.message}` : ""}`);
      for (const f of r.findings.slice(0, 6)) {
        console.log(`      ${f.label}: ${f.sensitive ? "•••" : f.value}`);
      }
    }
    break;
  }
  case "sources": {
    const { stats, sources } = await req("GET", "/api/v1/sources");
    console.log(`Registry: ${stats.total} total · ${stats.integrated} live · ${stats.requires_key} need keys`);
    for (const s of sources.filter((s) => s.status === "integrated")) {
      console.log(`  ✓ ${s.name} (${s.category})`);
    }
    break;
  }
  case "list": {
    const { investigations, total } = await req("GET", "/api/v1/investigations");
    console.log(`${total} investigations`);
    for (const i of investigations) console.log(`  ${i.id}  ${i.identifierType}  ${i.input}`);
    break;
  }
  default:
    console.log("lorn CLI\n  investigate <identifier> [--save]\n  sources\n  list");
}
