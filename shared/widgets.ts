/**
 * Widget registry (data side). Each widget type declares its category, label
 * and a zod schema for its config. The renderer registry (web/profile/widgets)
 * maps the same keys to React components. Adding a widget = one entry here +
 * one component there; the renderer itself never changes.
 */
import { z } from "zod";
import { safeUrl, hex } from "./profile-schema.ts";

const s = (max: number, d = "") => z.string().max(max).default(d);
const assetId = z.string().uuid().nullable().default(null);
const item = (shape: z.ZodRawShape, max = 30) => z.array(z.object(shape)).max(max).default([]);

export const WIDGETS = {
  // PERSONAL
  about: { category: "personal", label: "About me", schema: z.object({ title: s(60, "About me"), text: s(2000) }) },
  info: { category: "personal", label: "Personal information", schema: z.object({ rows: item({ label: z.string().max(40), value: z.string().max(120) }, 20) }) },
  languages: { category: "personal", label: "Languages", schema: z.object({ items: item({ name: z.string().max(30), level: z.enum(["native", "fluent", "conversational", "learning"]).default("fluent") }, 12) }) },
  location: { category: "personal", label: "Location", schema: z.object({ place: s(80), timezone: s(64) }) },
  skills: { category: "personal", label: "Skills", schema: z.object({ items: item({ name: z.string().max(40), level: z.number().min(0).max(100).default(70) }, 24) }) },
  projects: { category: "personal", label: "Projects", schema: z.object({ items: item({ name: z.string().max(60), description: z.string().max(200).default(""), url: z.union([safeUrl, z.literal("")]).default(""), imageAssetId: assetId }, 12) }) },
  text: { category: "personal", label: "Custom text", schema: z.object({ title: s(60), text: s(4000), align: z.enum(["left", "center", "right"]).default("left") }) },
  // GAMING
  games: { category: "gaming", label: "Games", schema: z.object({ items: item({ name: z.string().max(60), hours: z.number().min(0).max(100000).nullable().default(null), rank: z.string().max(40).default(""), imageAssetId: assetId }, 20) }) },
  setup: { category: "gaming", label: "Gaming setup", schema: z.object({ items: item({ label: z.string().max(40), value: z.string().max(120) }, 20) }) },
  hardware: { category: "gaming", label: "Hardware", schema: z.object({ cpu: s(80), gpu: s(80), ram: s(80), storage: s(80), monitor: s(80), peripherals: s(200) }) },
  gamestats: { category: "gaming", label: "Game statistics", schema: z.object({ game: s(60), stats: item({ label: z.string().max(40), value: z.string().max(40) }, 12) }) },
  collection: { category: "gaming", label: "Game collection", schema: z.object({ title: s(60, "Collection"), items: item({ name: z.string().max(60), imageAssetId: assetId }, 40) }) },
  crosshair: { category: "gaming", label: "Crosshair settings", schema: z.object({ game: s(40, "Valorant"), code: s(200), color: hex.default("#00ff88"), thickness: z.number().min(1).max(6).default(2), length: z.number().min(2).max(20).default(6), gap: z.number().min(0).max(12).default(3), dot: z.boolean().default(false) }) },
  // MEDIA
  gallery: { category: "media", label: "Image gallery", schema: z.object({ title: s(60), images: item({ assetId: z.string().uuid(), caption: z.string().max(120).default("") }, 30), columns: z.number().int().min(1).max(4).default(3) }) },
  videos: { category: "media", label: "Video gallery", schema: z.object({ title: s(60), videos: item({ assetId: z.string().uuid(), caption: z.string().max(120).default("") }, 12) }) },
  musiccollection: { category: "media", label: "Music collection", schema: z.object({ title: s(60, "Favourite music"), items: item({ title: z.string().max(80), artist: z.string().max(80).default(""), url: z.union([safeUrl, z.literal("")]).default(""), coverAssetId: assetId }, 20) }) },
  musicplayer: { category: "media", label: "Music player", schema: z.object({ layout: z.enum(["compact", "vinyl", "waveform", "lyrics"]).default("compact") }) },
  embed: { category: "media", label: "Media embed", schema: z.object({ provider: z.enum(["youtube", "spotify", "soundcloud", "twitch", "applemusic"]).default("youtube"), url: z.union([safeUrl, z.literal("")]).default("") }) },
  // SOCIAL (backed by integrations)
  discord: { category: "social", label: "Discord", schema: z.object({ showConnected: z.boolean().default(true) }) },
  discordserver: { category: "social", label: "Discord server", schema: z.object({ invite: z.string().regex(/^[A-Za-z0-9-]{2,32}$/).or(z.literal("")).default("") }) },
  roblox: { category: "social", label: "Roblox", schema: z.object({ userId: z.string().regex(/^\d{1,20}$/).or(z.literal("")).default("") }) },
  steam: { category: "social", label: "Steam", schema: z.object({ steamId: z.string().regex(/^\d{17}$/).or(z.literal("")).default(""), showGames: z.boolean().default(true) }) },
  spotify: { category: "social", label: "Spotify", schema: z.object({ url: z.union([safeUrl, z.literal("")]).default("") }) },
  youtube: { category: "social", label: "YouTube", schema: z.object({ channelId: z.string().regex(/^UC[\w-]{22}$/).or(z.literal("")).default("") }) },
  twitch: { category: "social", label: "Twitch", schema: z.object({ login: z.string().regex(/^\w{3,25}$/).or(z.literal("")).default("") }) },
  github: { category: "social", label: "GitHub", schema: z.object({ username: z.string().regex(/^[A-Za-z0-9-]{1,39}$/).or(z.literal("")).default(""), showRepos: z.boolean().default(true) }) },
  // UTILITY
  calendar: { category: "utility", label: "Calendar", schema: z.object({ title: s(60, "Upcoming"), events: item({ title: z.string().max(80), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }, 20) }) },
  countdown: { category: "utility", label: "Countdown", schema: z.object({ title: s(60, "Countdown"), target: z.string().datetime().nullable().default(null) }) },
  clock: { category: "utility", label: "Clock", schema: z.object({ timezone: s(64, "UTC"), hour12: z.boolean().default(false), seconds: z.boolean().default(true) }) },
  timezone: { category: "utility", label: "Timezone", schema: z.object({ timezone: s(64, "UTC"), label: s(40) }) },
  weather: { category: "utility", label: "Weather", schema: z.object({ place: s(80), latitude: z.number().min(-90).max(90).nullable().default(null), longitude: z.number().min(-180).max(180).nullable().default(null), unit: z.enum(["c", "f"]).default("c") }) },
  list: { category: "utility", label: "Custom list", schema: z.object({ title: s(60), items: item({ text: z.string().max(140) }, 30), ordered: z.boolean().default(false) }) },
  inforows: { category: "utility", label: "Information rows", schema: z.object({ rows: item({ label: z.string().max(40), value: z.string().max(140) }, 20) }) },
} satisfies Record<string, { category: string; label: string; schema: z.ZodTypeAny }>;

export type WidgetType = keyof typeof WIDGETS;
export const WIDGET_TYPES = Object.keys(WIDGETS) as WidgetType[];

export function widgetDefaults(type: WidgetType) {
  return WIDGETS[type].schema.parse({});
}

/** Validate and normalise every widget's config in a list. */
export function validateWidgets(list: { type: string; config: unknown }[], pathPrefix: (string | number)[], issues: { path: string; message: string }[]) {
  return list.map((w, i) => {
    const def = (WIDGETS as Record<string, { schema: z.ZodTypeAny }>)[w.type];
    if (!def) { issues.push({ path: [...pathPrefix, i, "type"].join("."), message: `Unknown widget type ${w.type}` }); return w; }
    const r = def.schema.safeParse(w.config ?? {});
    if (!r.success) {
      for (const iss of r.error.issues) issues.push({ path: [...pathPrefix, i, "config", ...iss.path].join("."), message: iss.message });
      return w;
    }
    return { ...w, config: r.data };
  });
}
