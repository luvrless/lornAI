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

export async function onRequestGet(context) {
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  if (!user?.username) {
    user = { id: "usr_guest", uid: 10420, username: "you", displayName: "You", email: "you@lorn.lol", emailVerified: true, createdAt: new Date().toISOString() };
  } else if (context.env?.LORNAI_KV) {
    try {
      const kvRaw = await context.env.LORNAI_KV.get(`user:${user.username.toLowerCase()}`);
      if (kvRaw) {
        const stored = JSON.parse(kvRaw);
        user = { ...user, ...stored };
      }
    } catch {}
  }

  // Get user profile views from KV (strictly profile visits, not Cloudflare edge pageviews)
  let userViews = 0;
  let isPublished = false;
  if (context.env?.LORNAI_KV && user.username) {
    try {
      const v = await context.env.LORNAI_KV.get(`views:${user.username.toLowerCase()}`);
      if (v) userViews = Number(v) || 0;
      const pub = await context.env.LORNAI_KV.get(`published:${user.username.toLowerCase()}`);
      if (pub === "true") isPublished = true;
    } catch {}
  }

  const data = {
    app: "lorn",
    user,
    url: "https://lorn.lol/" + user.username,
    createdAt: user.createdAt || new Date().toISOString(),
    profile: {
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      moderation_hidden: false
    },
    announcements: [],
    entitlements: [{ kind: "free" }],
    storage: { usedBytes: 0, quotaBytes: 104857600 },
    badges: [],
    completion: {
      percent: isPublished ? 100 : 50,
      checks: [
        { label: "Choose username", done: true },
        { label: "Set bio & title", done: true },
        { label: "Customize theme", done: isPublished },
        { label: "Publish live", done: isPublished }
      ]
    },
    analytics: {
      views30d: userViews,
      uniques30d: userViews,
      clicks30d: 0,
      allTime: userViews,
      previous: { views: 0, uniques: 0, clicks: 0 },
      series: []
    },
    activity: [
      { kind: "security", what: "Account registered", at: user.createdAt || new Date().toISOString() }
    ],
    unreadNotifications: 0
  };

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
