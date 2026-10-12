/**
 * Picks an icon for a profile link from its destination, so plain links get
 * a recognisable mark without the owner uploading anything.
 */

export const LINK_ICON_KEYS = [
  "whatsapp",
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "github",
  "x",
  "facebook",
  "telegram",
  "email",
  "phone",
  "internal",
  "web",
] as const;
export type LinkIconKey = (typeof LINK_ICON_KEYS)[number];

const HOSTS: Array<[RegExp, LinkIconKey]> = [
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)github\.com$/, "github"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x"],
  [/(^|\.)(facebook\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(t\.me|telegram\.me)$/, "telegram"],
];

export function linkIconFor(url: string | null): LinkIconKey {
  if (!url) return "web";
  if (url.startsWith("/")) return "internal";
  if (/^mailto:/i.test(url)) return "email";
  if (/^tel:/i.test(url)) return "phone";
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? "web";
  } catch {
    return "web";
  }
}
