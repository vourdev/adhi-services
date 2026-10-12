import type { Device, TrafficSource } from "@/lib/domain";

/**
 * Traffic source rules, applied once at ingestion so every report uses the
 * same definition:
 *
 * 1. utm_source / utm_medium win when present (campaign links you share).
 * 2. Otherwise the referrer host decides (search engine, social or chat app,
 *    any other site).
 * 3. No referrer and no UTM, or a referrer from this same site, counts as
 *    "direct", which also covers apps that strip the referrer (Instagram's
 *    in-app browser often does). It is never assumed to be social.
 */

const SEARCH_HOSTS = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.com",
  "yandex.",
  "baidu.com",
  "ecosia.org",
  "search.brave.com",
];

const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "messenger.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "lnkd.in",
  "t.co",
  "twitter.com",
  "x.com",
  "threads.net",
  "threads.com",
  "pinterest.",
  "reddit.com",
  "whatsapp.com",
  "wa.me",
  "t.me",
  "telegram.org",
  "discord.com",
  "line.me",
  "snapchat.com",
];

const SOCIAL_UTM_SOURCES = new Set([
  "instagram",
  "ig",
  "facebook",
  "fb",
  "tiktok",
  "tt",
  "youtube",
  "yt",
  "linkedin",
  "twitter",
  "x",
  "threads",
  "whatsapp",
  "wa",
  "telegram",
  "pinterest",
  "reddit",
  "discord",
  "line",
]);

const SEARCH_UTM_SOURCES = new Set([
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "yandex",
  "baidu",
  "ecosia",
]);

function hostMatches(host: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith(".")
      ? host.startsWith(pattern) || host.includes(`.${pattern}`)
      : host === pattern || host.endsWith(`.${pattern}`)
  );
}

/** Lowercase hostname without "www.", or null when the referrer is missing or unparseable. */
export function referrerHost(
  referrer: string | null | undefined
): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:" &&
      url.protocol !== "android-app:"
    )
      return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export function classifySource(input: {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  siteHost: string | null;
}): TrafficSource {
  const utmSource = input.utmSource?.toLowerCase().trim() || null;
  const utmMedium = input.utmMedium?.toLowerCase().trim() || null;

  if (utmSource || utmMedium) {
    if (utmSource && SOCIAL_UTM_SOURCES.has(utmSource)) return "social";
    if (utmSource && SEARCH_UTM_SOURCES.has(utmSource))
      return utmMedium === "social" ? "social" : "search";
    if (
      utmMedium === "social" ||
      utmMedium === "social-media" ||
      utmMedium === "bio"
    )
      return "social";
    if (
      utmMedium === "organic" ||
      utmMedium === "cpc" ||
      utmMedium === "search"
    )
      return "search";
    if (
      utmMedium === "referral" ||
      utmMedium === "email" ||
      utmMedium === "newsletter"
    )
      return "referral";
    return "other";
  }

  const host = input.referrerHost;
  if (!host) return "direct";
  const siteHost = input.siteHost?.toLowerCase().replace(/^www\./, "") ?? null;
  if (siteHost && host === siteHost) return "direct";
  if (hostMatches(host, SEARCH_HOSTS)) return "search";
  if (hostMatches(host, SOCIAL_HOSTS)) return "social";
  return "referral";
}

/** Coarse device class from the User-Agent. The raw User-Agent is not stored. */
export function detectDevice(userAgent: string | null | undefined): Device {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/.test(ua))
    return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/.test(ua))
    return "mobile";
  if (/windows|macintosh|linux|cros|x11/.test(ua)) return "desktop";
  return "unknown";
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|scrap|preview|facebookexternalhit|meta-externalagent|whatsapp|telegram|discord|skype|slack|embedly|quora link|vkshare|pinterest\/|bitly|headless|lighthouse|pagespeed|ptst|gtmetrix|curl\/|wget\/|python-requests|httpclient|axios\/|node-fetch|go-http-client|java\/|okhttp|monitor|uptime/i;

/** Link-preview fetchers, crawlers and scripted clients. Their requests are not counted. */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERN.test(userAgent);
}

/** Trims UTM values to something safe to store and group by. */
export function cleanUtm(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase().slice(0, 100);
  return cleaned || null;
}
