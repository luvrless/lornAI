async function resolveRoblox(rawId) {
  if (!rawId) return null;
  let cleanId = "";
  const urlMatch = String(rawId).match(/users\/(\d+)/i);
  if (urlMatch) {
    cleanId = urlMatch[1];
  } else if (/^\d+$/.test(String(rawId).trim())) {
    cleanId = String(rawId).trim();
  }

  try {
    let userObj = null;
    if (cleanId) {
      const uRes = await fetch(`https://users.roblox.com/v1/users/${cleanId}`);
      if (uRes.ok) userObj = await uRes.json();
    } else {
      // Look up by username
      const lookupRes = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [String(rawId).trim()], excludeBannedUsers: true })
      });
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        if (lookupData?.data?.[0]?.id) {
          cleanId = String(lookupData.data[0].id);
          userObj = lookupData.data[0];
        }
      }
    }

    if (!cleanId) return null;

    let avatarUrl = "";
    try {
      const avRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${cleanId}&size=150x150&format=Png&isCircular=false`);
      if (avRes.ok) {
        const avData = await avRes.json();
        avatarUrl = avData?.data?.[0]?.imageUrl || "";
      }
    } catch {}

    return {
      status: "ok",
      data: {
        id: cleanId,
        name: userObj?.name || rawId,
        displayName: userObj?.displayName || userObj?.name || rawId,
        url: `https://www.roblox.com/users/${cleanId}/profile`,
        avatar: avatarUrl,
        friends: 0,
        followers: 0
      }
    };
  } catch {
    return {
      status: "ok",
      data: {
        id: cleanId || rawId,
        name: rawId,
        displayName: rawId,
        url: cleanId ? `https://www.roblox.com/users/${cleanId}/profile` : "https://www.roblox.com",
        avatar: "",
        friends: 0,
        followers: 0
      }
    };
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const config = body.config || {};
    const widgets = (config.widgets || []).concat(
      (config.pages || []).flatMap(p => p.widgets || [])
    );

    const integrations = {};

    for (const w of widgets) {
      if (w.type === "roblox" && w.config?.userId) {
        const res = await resolveRoblox(w.config.userId);
        if (res) integrations[w.id] = res;
      } else if (w.type === "github" && w.config?.username) {
        integrations[w.id] = {
          status: "ok",
          data: {
            name: w.config.username,
            url: `https://github.com/${w.config.username}`,
            repos: [],
            languages: []
          }
        };
      }
    }

    return new Response(JSON.stringify({
      app: "lorn",
      integrations
    }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ app: "lorn", integrations: {} }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
}
