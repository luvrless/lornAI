async function resolveRoblox(rawId) {
  if (!rawId) return null;
  let cleanId = "";
  const urlMatch = String(rawId).match(/users\/(\d+)/i);
  if (urlMatch) {
    cleanId = urlMatch[1];
  } else if (/^\d+$/.test(String(rawId).trim())) {
    cleanId = String(rawId).trim();
  }

  const rbxHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
  };

  try {
    let userObj = null;
    if (cleanId) {
      const uRes = await fetch(`https://users.roblox.com/v1/users/${cleanId}`, { headers: rbxHeaders });
      if (uRes.ok) userObj = await uRes.json();
    } else {
      // Look up by username
      const lookupRes = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...rbxHeaders },
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
    let friendsCount = 0;
    let followersCount = 0;

    const [avRes, frRes, foRes] = await Promise.allSettled([
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${cleanId}&size=150x150&format=Png`, { headers: rbxHeaders }),
      fetch(`https://friends.roblox.com/v1/users/${cleanId}/friends/count`, { headers: rbxHeaders }),
      fetch(`https://friends.roblox.com/v1/users/${cleanId}/followers/count`, { headers: rbxHeaders })
    ]);

    if (avRes.status === "fulfilled" && avRes.value.ok) {
      const avData = await avRes.value.json().catch(() => null);
      avatarUrl = avData?.data?.[0]?.imageUrl || "";
    }
    if (!avatarUrl) {
      try {
        const hRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${cleanId}&size=150x150&format=Png&isCircular=false`);
        if (hRes.ok) {
          const hData = await hRes.json();
          avatarUrl = hData?.data?.[0]?.imageUrl || "";
        }
      } catch {}
    }

    if (frRes.status === "fulfilled" && frRes.value.ok) {
      const frData = await frRes.value.json().catch(() => null);
      if (typeof frData?.count === "number") friendsCount = frData.count;
    }

    if (foRes.status === "fulfilled" && foRes.value.ok) {
      const foData = await foRes.value.json().catch(() => null);
      if (typeof foData?.count === "number") followersCount = foData.count;
    }

    return {
      status: "ok",
      data: {
        id: cleanId,
        name: userObj?.name || rawId,
        displayName: userObj?.displayName || userObj?.name || rawId,
        url: `https://www.roblox.com/users/${cleanId}/profile`,
        avatar: avatarUrl,
        friends: friendsCount,
        followers: followersCount
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

async function resolveWidget(w, context, username) {
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
    let disc = null;
    if (context.env?.LORNAI_KV && username) {
      try {
        const raw = await context.env.LORNAI_KV.get(`connections:${username.toLowerCase()}`);
        if (raw) {
          const list = JSON.parse(raw);
          disc = list.find(c => c.provider === "discord");
        }
      } catch {}
    }
    return {
      status: "ok",
      data: {
        username: disc?.username || username || "Discord User",
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

export async function onRequestGet(context) {
  const username = (context.params.username || "").toLowerCase();
  let integrations = {};

  if (context.env?.LORNAI_KV && username) {
    try {
      const kvConfig = await context.env.LORNAI_KV.get(`published_config:${username}`) || await context.env.LORNAI_KV.get(`profile:${username}`);
      if (kvConfig) {
        const config = JSON.parse(kvConfig);
        const widgets = (config.widgets || []).concat(
          (config.pages || []).flatMap(p => p.widgets || [])
        );

        for (const w of widgets) {
          const res = await resolveWidget(w, context, username);
          if (res) integrations[w.id] = res;
        }
      }
    } catch {}
  }

  return new Response(JSON.stringify(integrations), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
