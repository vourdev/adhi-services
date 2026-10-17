/**
 * Product descriptions are stored as HTML from the editor (sanitized on the
 * server, see server/rich-text.ts). Descriptions written before the editor
 * are plain text; these helpers tell the two apart and convert between
 * them. Free of runtime imports, so the editor can use them in the browser.
 */

/** Editor output (or pasted HTML) starts with a tag; plain text does not. */
export function isRichText(value: string): boolean {
  return /^\s*<[a-z][a-z0-9]*[\s>/]/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const BULLET = /^\s*[-•*]\s+/;

/**
 * Plain text as the editor's HTML: blank lines start a paragraph, lines
 * starting with "-", "•" or "*" become a list (the rules the old plain text
 * view used).
 */
export function plainTextToHtml(text: string): string {
  const html: string[] = [];
  for (const paragraph of text.trim().split(/\n\s*\n/)) {
    let list: string[] = [];
    let lines: string[] = [];
    const flush = () => {
      if (lines.length) html.push(`<p>${lines.join("<br>")}</p>`);
      if (list.length) html.push(`<ul>${list.join("")}</ul>`);
      lines = [];
      list = [];
    };
    for (const raw of paragraph.split("\n")) {
      if (!raw.trim()) continue;
      if (BULLET.test(raw)) {
        if (lines.length) {
          html.push(`<p>${lines.join("<br>")}</p>`);
          lines = [];
        }
        list.push(
          `<li><p>${escapeHtml(raw.replace(BULLET, "").trim())}</p></li>`
        );
      } else {
        if (list.length) {
          html.push(`<ul>${list.join("")}</ul>`);
          list = [];
        }
        lines.push(escapeHtml(raw.trim()));
      }
    }
    flush();
  }
  return html.join("");
}

/** What a description says without its markup: for meta tags and length checks. */
export function richTextToPlain(value: string): string {
  if (!isRichText(value)) return value.replace(/\s+/g, " ").trim();
  return value
    .replace(/<\/(p|h2|h3|li|blockquote)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
