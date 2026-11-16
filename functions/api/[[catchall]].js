export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const method = context.request.method.toUpperCase();

  function json(data, status = 200) {
    return new Response(JSON.stringify({ app: "lorn", ...data }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  }

  function rawJson(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  }

  // Badges
  if (path.includes("/api/badges/me")) {
    return json({ badges: [], credits: 0, customRequests: [] });
  }

  if (path.includes("/api/badges/catalogue")) {
    return rawJson([]);
  }

  // Profile
  if (path.includes("/api/profile/status")) {
    return json({
      isPublished: false,
      hasUnpublishedChanges: false,
      publishedAt: null,
      moderationHidden: false
    });
  }

  if (path.includes("/api/profile/versions")) {
    return rawJson([]);
  }

  if (path.includes("/api/profile/preview")) {
    return json({ integrations: {} });
  }

  if (path.includes("/api/profile/draft")) {
    return json({ ok: true, rev: 2, premiumBlocked: [] });
  }

  // Media
  if (path.includes("/api/media/usage")) {
    return json({ usedBytes: 0, quotaBytes: 104857600, byKind: [] });
  }

  if (path.includes("/api/media-folders") || path.includes("/api/media/history")) {
    return rawJson([]);
  }

  if (path.includes("/api/media")) {
    return json({ items: [], total: 0 });
  }

  // Billing
  if (path.includes("/api/billing")) {
    return json({
      provider: "stripe",
      premium: false,
      verified: false,
      badgeCredits: 0,
      subscription: null,
      products: [
        { key: "premium", name: "Premium", price_cents: 499, currency: "usd", billing: "monthly", available: true, description: "Custom fonts, cursors, extra pages and more storage" }
      ],
      purchases: []
    });
  }

  // Analytics
  if (path.includes("/api/analytics")) {
    const now = new Date().toISOString();
    return json({
      range: { from: now, to: now },
      totals: { views: 0, uniques: 0, clicks: 0, unique_clicks: 0, plays: 0, ctr: 0 },
      previous: { views: 0, uniques: 0, clicks: 0, plays: 0 },
      series: [],
      links: [],
      referrers: [],
      campaigns: [],
      devices: [],
      browsers: [],
      os: [],
      countries: [],
      plays: [],
      allTime: 0
    });
  }

  // Account
  if (path.includes("/api/account/notifications")) {
    return method === "GET" ? rawJson([]) : json({ ok: true });
  }

  if (path.includes("/api/account/notification-prefs")) {
    return json({ email_security: true, email_product: false, inapp_all: true });
  }

  if (path.includes("/api/account/username-history") || path.includes("/api/account/sessions") || path.includes("/api/account/login-history")) {
    return rawJson([]);
  }

  // Support & Reports
  if (path.includes("/api/support/tickets") || path.includes("/api/reports/mine")) {
    return rawJson([]);
  }

  // Templates
  if (path.includes("/api/templates")) {
    return json({ items: [], total: 0 });
  }

  // Meta
  if (path.includes("/api/meta/integrations")) {
    return json({ discord: false, google: false });
  }

  // Auth helper routes
  if (path.includes("/api/auth/verify-email-code") || path.includes("/api/auth/resend-verification") || path.includes("/api/auth/forgot-password") || path.includes("/api/auth/reset-password")) {
    return json({ ok: true });
  }

  if (method === "GET") {
    return json({ items: [], total: 0 });
  }

  return json({ ok: true });
}
