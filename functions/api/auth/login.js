export async function onRequestPost(context) {
  function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...headers
      }
    });
  }

  try {
    const body = await context.request.json().catch(() => ({}));
    const identifier = (body.identifier || "").trim();
    const password = body.password || "";

    if (!identifier || !password) {
      return jsonResponse({ error: { code: "invalid_credentials", message: "Username/email and password are required" } }, 400);
    }

    let targetUsername = identifier.toLowerCase();

    // Check if identifier is email
    if (identifier.includes("@") && context.env?.LORNAI_KV) {
      try {
        const mapped = await context.env.LORNAI_KV.get(`email:${identifier.toLowerCase()}`);
        if (mapped) targetUsername = mapped;
      } catch {}
    }

    let user = null;

    if (context.env?.LORNAI_KV) {
      try {
        const storedRaw = await context.env.LORNAI_KV.get(`user:${targetUsername}`);
        if (storedRaw) {
          const stored = JSON.parse(storedRaw);
          if (stored.password && stored.password !== password) {
            return jsonResponse({ error: { code: "invalid_credentials", message: "Incorrect password" } }, 401);
          }
          user = {
            id: stored.id,
            uid: stored.uid,
            username: stored.username,
            email: stored.email,
            emailVerified: stored.emailVerified ?? true,
            displayName: stored.displayName || stored.username,
            createdAt: stored.createdAt || new Date().toISOString(),
            hasPassword: true,
            twoFactor: false
          };
        }
      } catch {}
    }

    // Fallback if not found in KV (e.g. guest or first time)
    if (!user) {
      const cleanName = identifier.includes("@") ? identifier.split("@")[0].slice(0, 12) : identifier.slice(0, 12);
      user = {
        id: "usr_" + Math.random().toString(36).slice(2, 10),
        uid: Math.floor(Math.random() * 89999 + 10000),
        username: cleanName,
        email: identifier.includes("@") ? identifier : `${cleanName}@lorn.lol`,
        emailVerified: true,
        displayName: cleanName,
        createdAt: new Date().toISOString(),
        hasPassword: true,
        twoFactor: false
      };
    }

    const token = btoa(unescape(encodeURIComponent(JSON.stringify(user)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const cookieHeader = `lorn_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;

    return jsonResponse({
      app: "lorn",
      ok: true,
      mfaRequired: false,
      user,
      csrf: "lorn_cf_csrf_token"
    }, 200, {
      "Set-Cookie": cookieHeader
    });
  } catch (err) {
    return jsonResponse({ error: { code: "internal_error", message: err.message || "Login failed" } }, 500);
  }
}
