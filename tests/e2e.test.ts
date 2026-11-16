/**
 * Browser end-to-end tests (Chromium via Playwright) against the real server,
 * real database and the production client bundle (run `tsx scripts/build.ts` first).
 * Covers acceptance 9–28, 51–53, 70–71 through the actual UI.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sharp from "sharp";
import { chromium, type Browser, type Page } from "playwright";
import { startHarness, Harness, OWNER_ID } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";
let h: Harness, browser: Browser;
const AVATAR = "/tmp/e2e-avatar.png", ART = "/tmp/e2e-art.png";
const errors: string[] = [];

before(async () => {
  process.env.STORAGE_DIR = fs.mkdtempSync("/tmp/lorn-e2e-");
  if (!fs.existsSync("dist/web/manifest.json")) throw new Error("Run `npx tsx scripts/build.ts` first");
  await sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 60, g: 120, b: 240 } } }).png().toFile(AVATAR);
  await sharp({ create: { width: 96, height: 96, channels: 4, background: { r: 167, g: 139, b: 250, alpha: 1 } } }).png().toFile(ART);
  h = await startHarness({ realOrigin: true });
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await h.close(); await closeHashPool(); });

const watch = (p: Page) => {
  if (process.env.RECORD_API) p.on("response", async (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/api/")) return;
    let body: unknown = null;
    try { body = (r.headers()["content-type"] ?? "").includes("json") ? await r.json() : null; } catch {}
    fs.appendFileSync(process.env.RECORD_API!, JSON.stringify({ m: r.request().method(), p: u.pathname + u.search, req: r.request().postData(), s: r.status(), body }) + "\n");
  });
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("response", (r) => { if (r.status() === 429) errors.push(`429: ${r.request().method()} ${new URL(r.url()).pathname}`); });
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|ERR_TUNNEL|ERR_NAME|net::ERR|status of (40[13]|503)/.test(m.text() + m.location().url)) errors.push(`console: ${m.text()}`); });
  return p;
};
const saved = (p: Page) => p.waitForSelector(".save-state:not(.dirty):not(.saving) >> text=Draft saved", { timeout: 15_000 });
const publicHtml = async (u: string) => (await fetch(`${h.base}/${u}`)).text();

test("desktop: build, publish and visit a profile through the real UI", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const p = watch(await ctx.newPage());

  // Register
  await p.goto(`${h.base}/register`);
  await p.fill("#reg-u", "jay");
  await p.getByLabel("Email").fill("jay@example.com");
  await p.getByLabel("Password").fill("Sunset-Driver-77");
  await p.check("input[type=checkbox]");
  await p.click("button:has-text('Create account')");
  await p.waitForURL("**/dashboard");
  await p.getByText("Welcome back, jay").waitFor();

  // Profile: identity + avatar upload through the media picker
  await p.goto(`${h.base}/dashboard/profile`);
  await p.getByLabel("Display name", { exact: true }).fill("Jay");
  await p.getByLabel("Bio", { exact: true }).fill("building lorn");
  await saved(p);
  await p.click("button:has-text('Avatar')");
  await p.click(".section-acc[data-open=true] >> button:has-text('Choose')");
  await p.locator(".modal input[type=file]").setInputFiles(AVATAR);
  await p.locator(".lp-avatar img[alt=\"Jay's avatar\"]").waitFor({ timeout: 20_000 });
  await saved(p);

  // Customize: video background (free plan), text effect, entry screen
  await p.goto(`${h.base}/dashboard/customize`);
  await p.click(".seg >> text=Video");
  await p.click(".section-acc[data-open=true] >> button:has-text('Choose')");
  await p.locator(".modal input[type=file]").setInputFiles("/tmp/t/test.mp4");
  await p.locator(".device video.lp-media").waitFor({ timeout: 30_000 });
  await p.click("button:has-text('Typography')");
  await p.getByLabel("Name effect", { exact: true }).selectOption("glitch");
  await p.click("button:has-text('Click to enter')");
  await p.getByRole("switch", { name: "Show an entry screen" }).click();
  await p.locator(".device .lp-entry").waitFor();
  await saved(p);

  // Links
  await p.goto(`${h.base}/dashboard/links`);
  await p.click("button:has-text('Add link')");
  await p.click(".modal button:has-text('GitHub')");
  await p.getByPlaceholder("https://").fill("https://github.com/luvrless");
  await p.locator(".device a[aria-label='GitHub']").waitFor();
  await saved(p);

  // Widgets
  await p.goto(`${h.base}/dashboard/widgets`);
  await p.click("button:has-text('Add widget')");
  await p.click(".modal .seg >> text=Utility");
  await p.click(".modal button:has-text('Clock')");
  await p.locator(".device .w-clock").waitFor();
  await saved(p);

  // Music
  await p.goto(`${h.base}/dashboard/music`);
  await p.click("button:has-text('Add track')");
  await p.locator(".modal input[type=file]").setInputFiles("/tmp/t/test.mp3");
  await p.locator("input[aria-label='Song name']").waitFor({ timeout: 20_000 });
  await saved(p);

  // Undo / redo work on the draft
  await p.goto(`${h.base}/dashboard/profile`);
  await p.getByLabel("Status", { exact: true }).fill("temp");
  await p.getByRole("button", { name: "Undo" }).click();
  assert.equal(await p.getByLabel("Status", { exact: true }).inputValue(), "");
  await p.getByRole("button", { name: "Redo" }).click();
  assert.equal(await p.getByLabel("Status", { exact: true }).inputValue(), "temp");
  await p.getByLabel("Status", { exact: true }).fill("");
  await saved(p);

  // 26: nothing is public before publishing
  // Until then visitors get the starter card: handle, join date, views and UID, and none of the draft.
  const starter = await publicHtml("jay");
  assert.match(starter, /lp-handle[^>]*>@<!-- -->jay|lp-handle[^>]*>@jay/);
  assert.match(starter, /UID/); assert.match(starter, /Joined/); assert.match(starter, /views/);
  assert.ok(!starter.includes("building lorn") && !starter.includes("lp-link"), "draft content stays private");
  await p.getByText("Starter card is public").waitFor();
  await p.click("button:has-text('Publish')");
  await p.getByText("Published version 1").waitFor();
  await p.locator(".status-pill.ok").waitFor();

  // 27/19: the public page — server-rendered, entry screen hides the profile until clicked
  const html = await publicHtml("jay");
  assert.match(html, /<title>Jay \(@jay\) · LORN\.LOL<\/title>/);
  assert.match(html, /property="og:image"/);
  assert.ok(!html.includes("building lorn</p>") || html.includes("lp-entry"), "profile content hidden behind entry screen");
  const visitor = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" });
  const v = watch(await visitor.newPage());
  await v.goto(`${h.base}/jay`);
  await v.locator(".lp-entry").waitFor();
  assert.equal(await v.locator(".lp-card").count(), 0, "card must not exist before entering");
  await v.click(".lp-entry-btn");
  await v.locator(".lp-entry.exit").waitFor(); // 20: exit transition runs
  await v.locator(".lp-card").waitFor();
  await v.locator(".lp-entry").waitFor({ state: "detached" });
  assert.equal(await v.locator(".lp-name").getAttribute("aria-label"), "Jay");
  await v.waitForTimeout(2500);
  await v.screenshot({ path: "/tmp/shots/e2e-desktop-profile.png" });
  assert.equal(await v.locator("video.lp-media").count(), 1);
  // 23: music actually plays after the entry click
  await v.getByRole("button", { name: "Pause" }).waitFor({ timeout: 10_000 });
  // 22: widget renders live
  await v.locator(".w-clock b").waitFor();
  // Link click is tracked from a real visitor
  const [popup] = await Promise.all([v.waitForEvent("popup"), v.click("a[aria-label='GitHub']")]);
  await popup.close();
  await new Promise((r) => setTimeout(r, 500));
  const stats = await (await fetch(`${h.base}/api/analytics`, { headers: { cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } })).json();
  assert.equal(stats.totals.views, 1);
  assert.equal(stats.totals.clicks, 1);
  // the public counter reflects the recorded view straight away (no stale cache)
  assert.equal((await (await fetch(`${h.base}/api/p/jay`)).json()).views, 1);

  // 26/28: later draft edits stay private; they persist across reloads
  await p.goto(`${h.base}/dashboard/profile`);
  await p.getByLabel("Bio", { exact: true }).fill("draft-only text");
  await saved(p);
  await p.reload();
  assert.equal(await p.getByLabel("Bio", { exact: true }).inputValue(), "draft-only text");
  assert.ok(!(await publicHtml("jay")).includes("draft-only text"));
  await v.reload();
  await v.click(".lp-entry-btn");
  await v.locator(".lp-card").waitFor();
  assert.equal(await v.locator(".lp-bio").getAttribute("aria-label"), "building lorn");

  // Version history shows the publish
  await p.getByRole("button", { name: "Version history" }).click();
  await p.getByText("Version 1").waitFor();
  await ctx.close(); await visitor.close();
});

test("mobile: the public profile fits a phone and the entry screen works by tap", async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = watch(await m.newPage());
  await p.goto(`${h.base}/jay`);
  await p.tap(".lp-entry-btn");
  await p.locator(".lp-card").waitFor();
  const { sw, iw } = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw + 1, `horizontal overflow: ${sw} > ${iw}`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: "/tmp/shots/e2e-mobile-profile.png" });
  // Dashboard on mobile: the sidebar is a drawer
  await p.goto(`${h.base}/login`);
  await p.getByLabel("Username or email").fill("jay");
  await p.getByLabel("Password").fill("Sunset-Driver-77");
  await p.tap("button:has-text('Log in')");
  await p.waitForURL("**/dashboard");
  await p.tap("button[aria-label='Open menu']");
  await p.locator(".sidebar.open").waitFor();
  await p.tap(".sidebar >> text=Analytics");
  await p.getByRole("heading", { name: "Analytics" }).waitFor();
  await m.close();
});

test("admin: owner signs in with Discord, creates a badge in the UI, and it appears on a profile", async () => {
  h.discord.users.set(OWNER_ID, { id: OWNER_ID, username: "q5" });
  h.discord.nextLogin = OWNER_ID;
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const p = watch(await ctx.newPage());
  await p.goto(`${h.base}/admin`);
  await p.click("text=Continue with Discord");
  await p.waitForURL("**/signup/complete**");
  await p.fill("#su-u", "q5");
  await p.check("input[type=checkbox]");
  await p.click("button:has-text('Create account')");
  await p.waitForURL(`${h.base}/admin`);
  await p.getByRole("heading", { name: "Dashboard" }).waitFor();
  assert.ok(await p.locator(".chip >> text=OWNER").count());

  await p.click(".sidebar >> text=Badge manager");
  await p.click("button:has-text('Create badge')");
  await p.getByLabel("Name", { exact: true }).fill("Domain Legend");
  await p.getByLabel("Internal ID").fill("domain_legend");
  await p.locator(".modal input[type=file]").setInputFiles(ART);
  await p.locator(".modal .lp-badge img").waitFor({ timeout: 15_000 });
  await p.click(".modal button:has-text('Create badge')");
  await p.getByText("Badge created").waitFor();

  const row = p.locator("tr", { hasText: "Domain Legend" });
  await row.locator("button:has-text('0')").click();
  await p.getByPlaceholder("Username or UID").fill("jay");
  await p.click(".modal button:has-text('Assign')");
  await p.getByText("Assigned to jay").waitFor();
  const pub = await (await fetch(`${h.base}/api/p/jay`)).json();
  assert.ok(pub.badges.some((b: any) => b.key === "domain_legend" && b.iconUrl));

  // Audit log shows it, through the UI
  await p.keyboard.press("Escape");
  await p.click(".sidebar >> text=Audit logs");
  await p.getByText("badge.assigned").first().waitFor();
  await p.getByText("Chain intact").waitFor();
  await p.screenshot({ path: "/tmp/shots/e2e-admin-audit.png" });
  await ctx.close();
});

test("53: a regular user can't get into the admin panel", async () => {
  const ctx = await browser.newContext();
  const p = watch(await ctx.newPage());
  await p.goto(`${h.base}/login`);
  await p.getByLabel("Username or email").fill("jay");
  await p.getByLabel("Password").fill("Sunset-Driver-77");
  await p.click("button:has-text('Log in')");
  await p.waitForURL("**/dashboard");
  await p.locator(".sidebar a[href='/dashboard/badges']").waitFor();
  assert.equal(await p.locator(".sidebar a[href='/admin']").count(), 0, "no admin link for regular users");
  // The panel doesn't even show a sign-in prompt to a regular member.
  await p.goto(`${h.base}/admin`);
  await p.getByText("Nothing here").waitFor();
  assert.equal(await p.getByText("Continue with Discord").count(), 0);
  // Signed-out visitors are sent to the ordinary login page.
  const anon = await browser.newContext(); const ap = watch(await anon.newPage());
  await ap.goto(`${h.base}/admin`);
  await ap.waitForURL("**/login?next=%2Fadmin");
  await anon.close();
  assert.equal((await (await fetch(`${h.base}/api/admin/users`, { headers: { cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } })).status), 403);
  await ctx.close();
});

test("every dashboard and admin screen opens without crashing", async () => {
  h.discord.nextLogin = OWNER_ID;
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const p = watch(await ctx.newPage());
  const calls = new Map<string, number>();
  p.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) calls.set(u.pathname, (calls.get(u.pathname) ?? 0) + 1); });
  await p.goto(`${h.base}/login`);
  await p.click("text=Continue with Discord");
  await p.waitForURL("**/dashboard");
  await p.locator(".sidebar a[href='/admin']").waitFor(); // the owner does see it
  const visit = async (prefix: string) => {
    await p.locator(`.sidebar a[href^="${prefix}"]`).first().waitFor();
    const hrefs = [...new Set(await p.locator(`.sidebar a[href^="${prefix}"]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")!)))];
    assert.ok(hrefs.length > 5, `found nav links for ${prefix}`);
    for (const href of hrefs) {
      await p.click(`.sidebar a[href="${href}"]`);
      await p.waitForLoadState("networkidle");
      await p.waitForTimeout(150);
      assert.equal(await p.locator(".crash").count(), 0, `${href} crashed`);
      assert.ok((await p.locator("main, .main, .content").first().innerText()).trim().length > 20, `${href} rendered content`);
      await p.screenshot({ path: `/tmp/shots/sweep${href.replace(/\//g, "_")}.png` });
    }
    return hrefs.length;
  };
  const d = await visit("/dashboard");
  await p.goto(`${h.base}/admin`);
  await p.click("text=Continue with Discord");
  await p.waitForURL(`${h.base}/admin`);
  const a = await visit("/admin");
  console.log(`swept ${d} dashboard + ${a} admin screens`);
  const storms = [...calls].filter(([, n]) => n > 12);
  assert.deepEqual(storms, [], "no endpoint is requested in a loop");
  await ctx.close();
});

test("badges page: the full catalogue, with working actions", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = watch(await ctx.newPage());
  await p.goto(`${h.base}/login`);
  await p.getByLabel("Username or email").fill("jay");
  await p.getByLabel("Password").fill("Sunset-Driver-77");
  await p.click("button:has-text('Log in')");
  await p.waitForURL("**/dashboard");
  await p.click(".sidebar >> text=Badges");
  await p.getByRole("button", { name: "All badges" }).waitFor();
  for (const name of ["Staff", "Helper", "Premium", "Verified", "Donor", "OG", "Gifter", "Server Booster", "Winner", "Second Place", "Third Place", "Image Host", "Bug Hunter", "Easter 2027", "Christmas 2026", "The Million"]) {
    await p.locator(".badge-card", { has: p.locator(`b:text-is("${name}")`) }).waitFor();
  }
  assert.equal(await p.locator(".badge-card", { hasText: "OG" }).first().locator(".badge-status").innerText(), "Unlocked");
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/tmp/shots/e2e-badges.png", fullPage: true });
  // Claim without the bot configured: an honest message, nothing granted.
  await p.locator(".badge-card", { hasText: "Server Booster" }).getByRole("button", { name: "Claim" }).click();
  await p.getByText("Server Booster checks aren't set up").waitFor();
  // Gift opens the gift form; Report opens a bug ticket.
  await p.locator(".badge-card", { hasText: "Gifter" }).getByRole("button", { name: "Gift" }).click();
  await p.getByRole("heading", { name: "Gift a product" }).waitFor();
  await p.keyboard.press("Escape");
  await p.locator(".badge-card", { hasText: "Bug Hunter" }).getByRole("button", { name: "Report" }).click();
  await p.getByRole("heading", { name: "New support ticket" }).waitFor();
  assert.equal(await p.locator(".modal select").first().inputValue(), "bug");
  await ctx.close();
});

test("no uncaught errors in any page", () => {
  assert.deepEqual(errors, []);
});
