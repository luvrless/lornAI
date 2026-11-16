function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const val = rest.join('=').trim();
    try { list[name] = decodeURIComponent(val); } catch { list[name] = val; }
  });
  return list;
}

function decodeToken(token) {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const jsonStr = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export const ALL_BADGES = [
  { id: "bdg_owner", key: "owner", name: "Founder", description: "The founder of LORN.LOL.", category: "founder", rarity: "mythic", iconPreset: "crown", color: "#facc15", gradientFrom: "#fde68a", gradientTo: "#f59e0b", tooltip: "Founder", hover: "glow", glow: 30 },
  { id: "bdg_staff", key: "staff", name: "Staff", description: "Be a part of the LORN.LOL staff team.", category: "staff", rarity: "legendary", iconPreset: "wrench", color: "#60a5fa", tooltip: "Staff", hover: "lift", glow: 20 },
  { id: "bdg_developer", key: "developer", name: "Developer", description: "Builds LORN.LOL.", category: "developer", rarity: "legendary", iconPreset: "code", color: "#22d3ee", tooltip: "Developer", hover: "glow", glow: 25 },
  { id: "bdg_helper", key: "helper", name: "Helper", description: "Be active and help users in the community.", category: "helper", rarity: "uncommon", iconPreset: "bulb", color: "#fbbf24", tooltip: "Helper", hover: "lift", glow: 15 },
  { id: "bdg_premium", key: "premium", name: "Premium", description: "Purchase the Premium package.", category: "premium", rarity: "rare", iconPreset: "gem", color: "#c084fc", tooltip: "Premium", hover: "glow", glow: 25, action: "premium" },
  { id: "bdg_verified", key: "verified", name: "Verified", description: "Purchase or be a known content creator.", category: "verified", rarity: "epic", iconPreset: "check", color: "#3b82f6", tooltip: "Verified", hover: "lift", glow: 20, action: "verified" },
  { id: "bdg_donor", key: "donor", name: "Donor", description: "Donate at least $10 to LORN.LOL.", category: "special", rarity: "rare", iconPreset: "coins", color: "#22c55e", tooltip: "Donor", hover: "lift", glow: 20, action: "donate" },
  { id: "bdg_og", key: "og", name: "OG", description: "Be one of the first 150 people on LORN.LOL.", category: "og", rarity: "legendary", iconPreset: "flame", color: "#fb923c", tooltip: "OG — one of the first 150", hover: "glow", glow: 30 },
  { id: "bdg_gifter", key: "gifter", name: "Gifter", description: "Gift a LORN.LOL product to another user.", category: "special", rarity: "rare", iconPreset: "gift", color: "#f59e0b", tooltip: "Gifter", hover: "lift", glow: 15, action: "gift" },
  { id: "bdg_server_booster", key: "server_booster", name: "Server Booster", description: "Boost the LORN.LOL Discord server.", category: "community", rarity: "rare", iconPreset: "boost", color: "#f472b6", tooltip: "Server Booster", hover: "glow", glow: 25, action: "claim_boost" },
  { id: "bdg_winner", key: "winner", name: "Winner", description: "Win a LORN.LOL event.", category: "event", rarity: "legendary", iconPreset: "trophy", color: "#facc15", tooltip: "Winner", hover: "glow", glow: 30 },
  { id: "bdg_second_place", key: "second_place", name: "Second Place", description: "Get second place in a LORN.LOL event.", category: "event", rarity: "epic", iconPreset: "award", color: "#cbd5e1", tooltip: "Second Place", hover: "lift", glow: 20 },
  { id: "bdg_third_place", key: "third_place", name: "Third Place", description: "Get third place in a LORN.LOL event.", category: "event", rarity: "rare", iconPreset: "award", color: "#d97706", tooltip: "Third Place", hover: "lift", glow: 15 },
  { id: "bdg_bug_hunter", key: "bug_hunter", name: "Bug Hunter", description: "Report a bug to the LORN.LOL team.", category: "helper", rarity: "uncommon", iconPreset: "bug", color: "#4ade80", tooltip: "Bug Hunter", hover: "lift", glow: 15, action: "report_bug" },
  { id: "bdg_early_supporter", key: "early_supporter", name: "Early Supporter", description: "Supported LORN.LOL early on.", category: "early_supporter", rarity: "rare", iconPreset: "heart", color: "#f472b6", tooltip: "Early Supporter", hover: "glow", glow: 20 },
  { id: "bdg_the_million", key: "the_million", name: "The Million", description: "Celebration badge for 1M users.", category: "milestone", rarity: "mythic", iconPreset: "party", color: "#38bdf8", tooltip: "Here for 1,000,000 users", hover: "glow", glow: 35 }
];

export async function onRequestGet(context) {
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  const username = user?.username ? user.username.toLowerCase() : "";

  let userOwned = ["og", "early_supporter"];
  if (context.env?.LORNAI_KV && username) {
    try {
      const stored = await context.env.LORNAI_KV.get(`badges:${username}`);
      if (stored) {
        userOwned = JSON.parse(stored);
      }
    } catch {}
  }

  const catalogue = ALL_BADGES.map(b => {
    const owned = userOwned.includes(b.key);
    return {
      ...b,
      owned,
      status: owned ? "Unlocked" : null,
      acquiredAt: owned ? (user?.createdAt || new Date().toISOString()) : null
    };
  });

  return new Response(JSON.stringify(catalogue), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
