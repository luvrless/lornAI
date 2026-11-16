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
    const username = (body.username || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const acceptTos = body.acceptTos;

    const errors = {};
    if (!username || !/^[A-Za-z0-9_.]{1,12}$/.test(username)) {
      errors.username = "Username must be 1-12 characters, letters, numbers, dot or underscore";
    }
    if (!email || !email.includes("@")) {
      errors.email = "Please enter a valid email address";
    }
    if (!password || password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (!acceptTos) {
      errors.acceptTos = "You must accept the Terms of Service";
    }

    if (Object.keys(errors).length > 0) {
      const details = Object.entries(errors).map(([path, message]) => ({ path, message }));
      return jsonResponse({ error: { code: "validation_failed", message: "Please fix the form errors", details } }, 400);
    }

    const lowerUsername = username.toLowerCase();

    // Check if user already exists in KV
    if (context.env?.LORNAI_KV) {
      try {
        const existing = await context.env.LORNAI_KV.get(`user:${lowerUsername}`);
        if (existing) {
          return jsonResponse({
            error: {
              code: "username_taken",
              message: "This username is taken",
              details: [{ path: "username", message: "This username is taken" }]
            }
          }, 400);
        }
      } catch {}
    }

    const user = {
      id: "usr_" + Math.random().toString(36).slice(2, 10),
      uid: Math.floor(Math.random() * 89999 + 10000),
      username,
      email,
      emailVerified: true,
      displayName: username,
      createdAt: new Date().toISOString(),
      hasPassword: true,
      twoFactor: false
    };

    // Save user & credential to KV
    if (context.env?.LORNAI_KV) {
      try {
        await context.env.LORNAI_KV.put(`user:${lowerUsername}`, JSON.stringify({
          ...user,
          password
        }));
        await context.env.LORNAI_KV.put(`email:${email}`, lowerUsername);

        // Update platform member count
        const currMembers = Number(await context.env.LORNAI_KV.get("stats:members")) || 1;
        await context.env.LORNAI_KV.put("stats:members", String(currMembers + 1));
      } catch {}
    }

    const token = btoa(unescape(encodeURIComponent(JSON.stringify(user)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const cookieHeader = `lorn_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;

    return jsonResponse({
      app: "lorn",
      ok: true,
      user,
      verificationEmail: "none",
      csrf: "lorn_cf_csrf_token"
    }, 200, {
      "Set-Cookie": cookieHeader
    });
  } catch (err) {
    return jsonResponse({ error: { code: "internal_error", message: err.message || "Registration failed" } }, 500);
  }
}
