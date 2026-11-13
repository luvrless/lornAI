/**
 * The profile configuration contract, shared by the API (validation), the
 * editor (controls + defaults) and the renderer. Only typed values are
 * allowed: no HTML, no CSS strings, no script. Asset references are IDs that
 * the server resolves and ownership-checks.
 */
import { z } from "zod";

export const hex = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, "Use a hex colour like #3b82f6");
const assetId = z.string().uuid().nullable().default(null);
const pct = (d: number) => z.number().min(0).max(100).default(d);
const txt = (max: number, d = "") => z.string().max(max).default(d);

const SAFE_SCHEMES = ["https:", "http:", "mailto:"];
export function isSafeUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (!SAFE_SCHEMES.includes(url.protocol)) return false;
    if (url.protocol !== "mailto:" && !url.hostname.includes(".")) return false;
    if (url.username || url.password) return false;
    return true;
  } catch { return false; }
}
export const safeUrl = z.string().trim().max(2048).refine(isSafeUrl, "Only http(s) and mailto links are allowed");

// ------------------------------------------------------------------ enums

export const BG_EFFECTS = ["galaxy", "stars", "aurora", "particles", "liquid", "silk", "clouds", "lightning", "plasma", "iridescence", "crt", "dither", "lightRays", "rain", "snow", "gradientFlow"] as const;
export const OVERLAY_EFFECTS = ["none", "snow", "rain", "stars", "petals", "fireworks", "particles", "lightRays", "floating", "ambient"] as const;
export const TEXT_EFFECTS = ["none", "typewriter", "glitch", "decrypt", "wave", "rainbow", "split", "reveal", "gradientShift"] as const;
export const ENTRANCE_ANIMS = ["none", "fade", "fadeUp", "fadeDown", "zoom", "blur", "slideLeft", "slideRight", "flip", "bounce"] as const;
export const HOVER_EFFECTS = ["none", "lift", "glow", "scale", "tilt", "shine"] as const;
export const ENTRY_TRANSITIONS = ["fade", "zoom", "blur", "slide", "curtain", "dissolve", "glitch", "ripple", "pixel"] as const;
export const FONTS = ["Inter", "Manrope", "Space Grotesk", "JetBrains Mono", "Playfair Display", "Outfit", "Sora", "Syne", "Unbounded", "DM Serif Display", "Press Start 2P", "system"] as const;
export const PLAYER_LAYOUTS = ["minimal", "compact", "vinyl", "waveform", "lyrics", "marquee", "background"] as const;
export const PAGE_LAYOUTS = ["magazine", "deck", "stack", "wall", "spine", "collage", "flow", "grid"] as const;
export const CARD_LAYOUTS = ["classic", "centered", "split", "minimal", "wide"] as const;
export const CURSOR_TYPES = ["default", "dot", "ring", "crosshair", "custom", "none"] as const;
export const CURSOR_TRAILS = ["none", "line", "sparkle", "bubbles", "glow", "comet"] as const;

export const PLATFORMS = {
  discord: { label: "Discord", hosts: ["discord.com", "discord.gg", "discordapp.com"] },
  roblox: { label: "Roblox", hosts: ["roblox.com"] },
  steam: { label: "Steam", hosts: ["steamcommunity.com", "store.steampowered.com"] },
  spotify: { label: "Spotify", hosts: ["open.spotify.com", "spotify.com", "spotify.link"] },
  youtube: { label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  tiktok: { label: "TikTok", hosts: ["tiktok.com"] },
  twitch: { label: "Twitch", hosts: ["twitch.tv"] },
  instagram: { label: "Instagram", hosts: ["instagram.com"] },
  x: { label: "X", hosts: ["x.com", "twitter.com"] },
  github: { label: "GitHub", hosts: ["github.com"] },
  telegram: { label: "Telegram", hosts: ["t.me", "telegram.me"] },
  reddit: { label: "Reddit", hosts: ["reddit.com"] },
  snapchat: { label: "Snapchat", hosts: ["snapchat.com"] },
  soundcloud: { label: "SoundCloud", hosts: ["soundcloud.com"] },
  applemusic: { label: "Apple Music", hosts: ["music.apple.com"] },
  playstation: { label: "PlayStation", hosts: ["psnprofiles.com", "playstation.com", "my.playstation.com"] },
  xbox: { label: "Xbox", hosts: ["xbox.com", "account.xbox.com", "xboxgamertag.com"] },
  bluesky: { label: "Bluesky", hosts: ["bsky.app"] },
  patreon: { label: "Patreon", hosts: ["patreon.com"] },
  email: { label: "Email", hosts: [] },
  custom: { label: "Custom link", hosts: [] },
} as const;
export type PlatformKey = keyof typeof PLATFORMS;

export function hostMatches(url: string, platform: PlatformKey): boolean {
  const hosts: readonly string[] = PLATFORMS[platform].hosts;
  if (platform === "email") return url.startsWith("mailto:");
  if (!hosts.length) return true;
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return hosts.some((x) => h === x || h.endsWith("." + x));
  } catch { return false; }
}

// ------------------------------------------------------------------ sections

const anim = z.object({
  type: z.enum(ENTRANCE_ANIMS).default("fadeUp"),
  durationMs: z.number().int().min(100).max(5000).default(600),
  delayMs: z.number().int().min(0).max(5000).default(0),
  stagger: z.number().int().min(0).max(1000).default(60),
  intensity: pct(50),
}).default({});

export const linkSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{6,24}$/),
  platform: z.enum(Object.keys(PLATFORMS) as [PlatformKey, ...PlatformKey[]]),
  url: safeUrl,
  title: txt(60),
  description: txt(140),
  iconAssetId: assetId,
  iconOnly: z.boolean().default(false),
  featured: z.boolean().default(false),
  visible: z.boolean().default(true),
  archived: z.boolean().default(false),
  color: hex.nullable().default(null),
  hover: z.enum(HOVER_EFFECTS).default("lift"),
  startAt: z.string().datetime().nullable().default(null),
  endAt: z.string().datetime().nullable().default(null),
}).superRefine((l, ctx) => {
  if (!hostMatches(l.url, l.platform)) ctx.addIssue({ code: "custom", path: ["url"], message: `This doesn't look like a ${PLATFORMS[l.platform].label} link` });
  if (l.startAt && l.endAt && l.startAt >= l.endAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "End must be after start" });
});
export type ProfileLink = z.infer<typeof linkSchema>;

const lyricLine = z.object({ t: z.number().min(0).max(36000), text: z.string().max(200) });
export const trackSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{6,24}$/),
  assetId: z.string().uuid(),
  title: txt(100, "Untitled"),
  artist: txt(100),
  coverAssetId: assetId,
  lyrics: z.array(lyricLine).max(500).default([]),
});

const embedSchema = z.object({
  provider: z.enum(["spotify", "youtube", "applemusic", "twitch", "soundcloud"]),
  url: safeUrl,
});

// Widget config is validated per type by the widget registry (widgets.ts).
export const widgetSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{6,24}$/),
  type: z.string().max(40),
  visible: z.boolean().default(true),
  span: z.number().int().min(1).max(3).default(1),
  config: z.record(z.unknown()).default({}),
});

export const pageSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{6,24}$/),
  slug: z.string().regex(/^[a-z0-9-]{1,32}$/, "Lowercase letters, numbers and dashes"),
  title: txt(60, "Page"),
  description: txt(300),
  layout: z.enum(PAGE_LAYOUTS).default("stack"),
  visible: z.boolean().default(true),
  backgroundAssetId: assetId,
  backgroundColor: hex.nullable().default(null),
  animation: anim,
  widgets: z.array(widgetSchema).max(40).default([]),
});

export const profileConfigSchema = z.object({
  version: z.literal(1).default(1),
  identity: z.object({
    displayName: txt(32),
    bio: txt(500),
    location: txt(60),
    website: z.union([safeUrl, z.literal("")]).default(""),
    languages: z.array(z.string().max(24)).max(10).default([]),
    status: txt(80),
    showJoined: z.boolean().default(true),
    showViews: z.boolean().default(true),
    showUid: z.boolean().default(true),
  }).default({}),
  avatar: z.object({
    assetId,
    shape: z.enum(["circle", "rounded", "square"]).default("circle"),
    size: z.number().int().min(48).max(220).default(112),
    zoom: z.number().min(1).max(4).default(1),
    offsetX: z.number().min(-50).max(50).default(0),
    offsetY: z.number().min(-50).max(50).default(0),
    borderWidth: z.number().int().min(0).max(12).default(2),
    borderColor: hex.default("#93c5fd55"),
    glow: pct(30),
  }).default({}),
  banner: z.object({
    assetId,
    height: z.number().int().min(60).max(320).default(140),
    posX: pct(50), posY: pct(50),
    scale: z.number().min(1).max(3).default(1),
    blur: z.number().min(0).max(40).default(0),
    opacity: pct(100),
    overlayColor: hex.default("#02061700"),
  }).default({}),
  background: z.object({
    type: z.enum(["color", "gradient", "image", "video", "effect"]).default("effect"),
    color: hex.default("#020617"),
    gradientFrom: hex.default("#0b1638"), gradientVia: hex.nullable().default(null), gradientTo: hex.default("#020617"),
    gradientAngle: z.number().int().min(0).max(360).default(160),
    gradientAnimated: z.boolean().default(false),
    assetId,
    effect: z.enum(BG_EFFECTS).default("aurora"),
    effectColors: z.array(hex).min(1).max(4).default(["#1d4ed8", "#38bdf8", "#6366f1"]),
    speed: z.number().min(0.1).max(4).default(1),
    intensity: pct(60), density: pct(50),
    opacity: pct(100), brightness: z.number().min(0).max(200).default(100),
    contrast: z.number().min(0).max(200).default(100), saturation: z.number().min(0).max(200).default(100),
    blur: z.number().min(0).max(40).default(0),
    overlayColor: hex.default("#020617"), overlayOpacity: pct(25),
    posX: pct(50), posY: pct(50), scale: z.number().min(1).max(3).default(1),
    videoLoop: z.boolean().default(true), playbackRate: z.number().min(0.25).max(2).default(1),
  }).default({}),
  card: z.object({
    layout: z.enum(CARD_LAYOUTS).default("classic"),
    width: z.number().int().min(320).max(900).default(520),
    minHeight: z.number().int().min(0).max(1200).default(0),
    verticalAlign: z.enum(["top", "center", "bottom"]).default("center"),
    align: z.enum(["left", "center", "right"]).default("center"),
    padding: z.number().int().min(8).max(64).default(28),
    radius: z.number().int().min(0).max(48).default(24),
    bgColor: hex.default("#0b1226"), bgOpacity: pct(55), blur: z.number().min(0).max(40).default(18),
    borderWidth: z.number().int().min(0).max(6).default(1),
    borderColor: hex.default("#93c5fd33"),
    borderGradient: z.boolean().default(false), borderFrom: hex.default("#38bdf8"), borderTo: hex.default("#6366f1"),
    shadow: pct(50), glowColor: hex.default("#3b82f6"), glow: pct(20),
    tilt3d: z.boolean().default(false), tiltMax: z.number().min(0).max(25).default(8),
    mouseGlow: z.boolean().default(true),
    hover: z.enum(HOVER_EFFECTS).default("none"),
  }).default({}),
  typography: z.object({
    font: z.enum(FONTS).default("Inter"),
    customFontAssetId: assetId,
    weight: z.number().int().min(100).max(900).default(500),
    headingWeight: z.number().int().min(100).max(900).default(700),
    size: z.number().min(12).max(22).default(15),
    nameSize: z.number().min(16).max(64).default(30),
    letterSpacing: z.number().min(-2).max(10).default(0),
    lineHeight: z.number().min(1).max(2.4).default(1.55),
    align: z.enum(["left", "center", "right"]).default("center"),
    color: hex.default("#e2e8f0"), mutedColor: hex.default("#94a3b8"), accentColor: hex.default("#60a5fa"),
    nameGradient: z.boolean().default(false), gradientFrom: hex.default("#93c5fd"), gradientTo: hex.default("#c4b5fd"),
    shadow: pct(0), glow: pct(0), glowColor: hex.default("#60a5fa"),
    nameEffect: z.enum(TEXT_EFFECTS).default("none"),
    bioEffect: z.enum(TEXT_EFFECTS).default("none"),
    effectSpeed: z.number().min(0.25).max(4).default(1),
    effectLoop: z.boolean().default(false),
  }).default({}),
  cursor: z.object({
    type: z.enum(CURSOR_TYPES).default("default"),
    assetId,
    size: z.number().int().min(8).max(64).default(20),
    color: hex.default("#93c5fd"),
    trail: z.enum(CURSOR_TRAILS).default("none"),
    trailLength: z.number().int().min(4).max(40).default(14),
    glow: pct(40),
    hoverScale: z.number().min(1).max(3).default(1.6),
  }).default({}),
  effects: z.object({
    overlay: z.enum(OVERLAY_EFFECTS).default("none"),
    color: hex.default("#e0f2fe"),
    density: pct(40), speed: z.number().min(0.1).max(4).default(1),
    size: z.number().min(0.5).max(4).default(1),
    ambientLight: z.boolean().default(true),
  }).default({}),
  animations: z.object({
    profile: anim, avatar: anim, name: anim, bio: anim, links: anim, badges: anim, widgets: anim,
    reducedMotionFallback: z.boolean().default(true),
  }).default({}),
  entry: z.object({
    enabled: z.boolean().default(false),
    title: txt(60, "click to enter"),
    subtitle: txt(80),
    description: txt(200),
    buttonText: txt(30, "Enter"),
    buttonIcon: z.enum(["none", "arrow", "play", "sparkles", "door", "power"]).default("arrow"),
    buttonStyle: z.enum(["glass", "solid", "outline", "text"]).default("glass"),
    typewriter: z.boolean().default(true),
    typewriterPauseMs: z.number().int().min(0).max(10000).default(1300),
    bgType: z.enum(["blur", "color", "gradient", "image", "video", "effect"]).default("blur"),
    color: hex.default("#020617"), gradientFrom: hex.default("#0b1638"), gradientTo: hex.default("#020617"),
    assetId, effect: z.enum(BG_EFFECTS).default("stars"),
    blur: z.number().min(0).max(40).default(16),
    font: z.enum(FONTS).default("Inter"),
    textColor: hex.default("#e2e8f0"),
    soundAssetId: assetId, volume: pct(60),
    enterAnim: z.enum(ENTRANCE_ANIMS).default("fade"),
    exit: z.enum(ENTRY_TRANSITIONS).default("fade"),
    exitMs: z.number().int().min(200).max(3000).default(800),
  }).default({}),
  music: z.object({
    enabled: z.boolean().default(false),
    layout: z.enum(PLAYER_LAYOUTS).default("compact"),
    autoplay: z.boolean().default(true),
    volume: pct(50),
    shuffle: z.boolean().default(false),
    loop: z.enum(["none", "one", "all"]).default("all"),
    position: z.enum(["card", "bottom", "top"]).default("card"),
    tracks: z.array(trackSchema).max(50).default([]),
    embeds: z.array(embedSchema).max(5).default([]),
  }).default({}),
  links: z.array(linkSchema).max(60).default([]),
  linksStyle: z.object({
    layout: z.enum(["icons", "buttons", "grid"]).default("icons"),
    iconSize: z.number().int().min(16).max(48).default(26),
    iconColor: hex.default("#e2e8f0"),
    useBrandColors: z.boolean().default(false),
    buttonColor: hex.default("#0f1a33"), buttonOpacity: pct(60),
  }).default({}),
  badgesStyle: z.object({
    show: z.boolean().default(true),
    size: z.number().int().min(14).max(40).default(22),
    background: z.boolean().default(true),
    position: z.enum(["name", "below"]).default("name"),
  }).default({}),
  widgets: z.array(widgetSchema).max(40).default([]),
  pages: z.array(pageSchema).max(10).default([]),
  seo: z.object({
    title: txt(70), description: txt(200),
    ogImageAssetId: assetId, faviconAssetId: assetId,
    indexable: z.boolean().default(true),
  }).default({}),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
}).superRefine((c, ctx) => {
  const slugs = new Set<string>();
  c.pages.forEach((p, i) => {
    if (slugs.has(p.slug)) ctx.addIssue({ code: "custom", path: ["pages", i, "slug"], message: "Page slugs must be unique" });
    slugs.add(p.slug);
  });
  const ids = new Set<string>();
  c.links.forEach((l, i) => {
    if (ids.has(l.id)) ctx.addIssue({ code: "custom", path: ["links", i, "id"], message: "Duplicate link id" });
    ids.add(l.id);
  });
});

export type ProfileConfig = z.infer<typeof profileConfigSchema>;
export const defaultConfig = (): ProfileConfig => profileConfigSchema.parse({});

/** Every asset ID referenced anywhere in a config (keys ending in AssetId / assetId). */
export function assetRefs(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => assetRefs(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if ((k === "assetId" || k.endsWith("AssetId")) && typeof v === "string") out.add(v);
      else assetRefs(v, out);
    }
  }
  return out;
}

/** Is a link live at time `now` (scheduling + visibility + archive)? */
export function linkIsLive(l: ProfileLink, now = new Date()): boolean {
  if (!l.visible || l.archived) return false;
  if (l.startAt && new Date(l.startAt) > now) return false;
  if (l.endAt && new Date(l.endAt) <= now) return false;
  return true;
}

export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

/** Premium-only fields: kept in one place so entitlement checks are data-driven. */
export const PREMIUM_FEATURES: { path: string; test: (c: ProfileConfig) => boolean; label: string }[] = [
  { path: "typography.customFontAssetId", test: (c) => !!c.typography.customFontAssetId, label: "Custom fonts" },
  { path: "cursor.type", test: (c) => c.cursor.type === "custom", label: "Custom cursor images" },
  { path: "pages", test: (c) => c.pages.length > 2, label: "More than 2 extra pages" },
  { path: "music.tracks", test: (c) => c.music.tracks.length > 3, label: "More than 3 music tracks" },
];
