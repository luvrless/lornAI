/** @jsxRuntime automatic @jsxImportSource react */
import type { IconType } from "react-icons";
import {
  SiDiscord, SiRoblox, SiSteam, SiSpotify, SiYoutube, SiTiktok, SiTwitch, SiInstagram, SiX, SiGithub, SiTelegram, SiReddit,
  SiSnapchat, SiSoundcloud, SiApplemusic, SiPlaystation, SiBluesky, SiPatreon,
} from "react-icons/si";
import {
  LuCrown, LuBadgeCheck, LuShield, LuCode, LuStar, LuFlame, LuSnowflake, LuEgg, LuSun, LuGem, LuHeart, LuZap, LuTrophy, LuGlobe,
  LuBug, LuSparkles, LuRocket, LuMusic, LuGamepad2, LuMedal, LuMail, LuLink, LuWrench, LuLightbulb, LuHandCoins, LuGift, LuAward, LuImage, LuPartyPopper,
} from "react-icons/lu";

export const PLATFORM_ICONS: Record<string, IconType> = {
  discord: SiDiscord, roblox: SiRoblox, steam: SiSteam, spotify: SiSpotify, youtube: SiYoutube, tiktok: SiTiktok, twitch: SiTwitch,
  instagram: SiInstagram, x: SiX, github: SiGithub, telegram: SiTelegram, reddit: SiReddit, snapchat: SiSnapchat, soundcloud: SiSoundcloud,
  applemusic: SiApplemusic, playstation: SiPlaystation, xbox: LuGamepad2, bluesky: SiBluesky, patreon: SiPatreon, email: LuMail, custom: LuLink,
};

export const BRAND_COLORS: Record<string, string> = {
  discord: "#5865F2", roblox: "#e2e8f0", steam: "#66c0f4", spotify: "#1DB954", youtube: "#FF0033", tiktok: "#25F4EE", twitch: "#9146FF",
  instagram: "#E1306C", x: "#e2e8f0", github: "#e2e8f0", telegram: "#26A5E4", reddit: "#FF4500", snapchat: "#FFFC00", soundcloud: "#FF5500",
  applemusic: "#FA243C", playstation: "#0070D1", xbox: "#107C10", bluesky: "#0085FF", patreon: "#FF424D", email: "#93c5fd", custom: "#93c5fd",
};

export const BADGE_GLYPHS: Record<string, IconType> = {
  crown: LuCrown, check: LuBadgeCheck, shield: LuShield, code: LuCode, star: LuStar, flame: LuFlame, snowflake: LuSnowflake, egg: LuEgg,
  sun: LuSun, gem: LuGem, heart: LuHeart, bolt: LuZap, trophy: LuTrophy, globe: LuGlobe, bug: LuBug, sparkles: LuSparkles, rocket: LuRocket,
  music: LuMusic, gamepad: LuGamepad2, medal: LuMedal, wrench: LuWrench, bulb: LuLightbulb, coins: LuHandCoins, gift: LuGift,
  boost: LuGem, award: LuAward, image: LuImage, party: LuPartyPopper,
};
