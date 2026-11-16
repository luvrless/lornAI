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

async function resolveWidget(w, context) {
  if (w.type === "roblox" && w.config?.userId) {
    return await resolveRoblox(w.config.userId);
  }
  if (w.type === "github" && w.config?.username) {
    const ghUser = w.config.username.trim();
    try {
      const ghRes = await fetch(`https://api.github.com/users/${encodeURIComponent(ghUser)}`, {
        headers: { "User-Agent": "LornAI/1.0" }
      });
      if (ghRes.ok) {
        const d = await ghRes.json();
        return {
          status: "ok",
          data: {
            login: d.login || ghUser,
            name: d.name || d.login || ghUser,
            url: d.html_url || `https://github.com/${ghUser}`,
            publicRepos: d.public_repos || 0,
            stars: 0,
            followers: d.followers || 0,
            languages: [],
            repos: []
          }
        };
      }
    } catch {}
    return {
      status: "ok",
      data: {
        login: ghUser,
        name: ghUser,
        url: `https://github.com/${ghUser}`,
        publicRepos: 0,
        stars: 0,
        followers: 0,
        languages: [],
        repos: []
      }
    };
  }
  if (w.type === "discord") {
    return {
      status: "ok",
      data: {
        username: "Discord User",
        avatar: ""
      }
    };
  }
  if (w.type === "discordserver" && w.config?.invite) {
    const inv = w.config.invite.trim();
    try {
      const invRes = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(inv)}?with_counts=true`);
      if (invRes.ok) {
        const d = await invRes.json();
        return {
          status: "ok",
          data: {
            name: d.guild?.name || "Discord Server",
            icon: d.guild?.icon ? `https://cdn.discordapp.com/icons/${d.guild.id}/${d.guild.icon}.png` : null,
            members: d.approximate_member_count || 100,
            online: d.approximate_presence_count || 20,
            url: `https://discord.gg/${inv}`
          }
        };
      }
    } catch {}
    return {
      status: "ok",
      data: {
        name: "Discord Server",
        icon: null,
        members: 50,
        online: 10,
        url: `https://discord.gg/${inv}`
      }
    };
  }
  if (w.type === "twitch" && w.config?.login) {
    const log = w.config.login.trim();
    return {
      status: "ok",
      data: {
        name: log,
        url: `https://twitch.tv/${log}`,
        avatar: "",
        live: false,
        game: null,
        viewers: 0
      }
    };
  }
  if (w.type === "youtube" && w.config?.channelId) {
    const ch = w.config.channelId.trim();
    return {
      status: "ok",
      data: {
        title: "YouTube Channel",
        url: `https://youtube.com/channel/${ch}`,
        avatar: "",
        subscribers: 0,
        latest: []
      }
    };
  }
  if (w.type === "steam" && w.config?.steamId) {
    const st = w.config.steamId.trim();
    return {
      status: "ok",
      data: {
        name: "Steam Player",
        url: `https://steamcommunity.com/profiles/${st}`,
        avatar: "",
        gameCount: 0,
        recent: [],
        top: []
      }
    };
  }
  return null;
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
      const res = await resolveWidget(w, context);
      if (res) integrations[w.id] = res;
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
