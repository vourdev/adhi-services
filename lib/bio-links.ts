/**
 * Splits a bio into plain text and web addresses, so the profile can show
 * "Portfolio: https://example.dev" as "Portfolio: example.dev" with a link.
 * Only http and https addresses count; punctuation that usually ends a
 * sentence stays outside the link.
 */

export type BioSegment =
  | { kind: "text"; text: string }
  | { kind: "link"; href: string; label: string };

const URL_PATTERN = /https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]]/g;

/** The address as people write it: no protocol, no trailing slash. */
function labelFor(url: URL): string {
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.host}${path}${url.search}`;
}

export function bioSegments(text: string): BioSegment[] {
  const segments: BioSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    let url: URL;
    try {
      url = new URL(match[0]);
    } catch {
      continue;
    }
    if (match.index > last)
      segments.push({ kind: "text", text: text.slice(last, match.index) });
    segments.push({ kind: "link", href: url.href, label: labelFor(url) });
    last = match.index + match[0].length;
  }
  if (last < text.length)
    segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}
