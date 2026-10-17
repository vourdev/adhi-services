import sanitizeHtml from "sanitize-html";

import { isRichText, plainTextToHtml } from "@/lib/rich-text";

/**
 * The only markup a product description may keep: what the editor's toolbar
 * can make. Everything else (scripts, styles, images, iframes, event
 * handlers, classes) is dropped. Links may only point to https, http or
 * mailto, and always open in a new tab without passing the page along.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h2",
    "h3",
    "strong",
    "em",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
  ],
  // target and rel are set by transformTags below, whatever the input said.
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["https", "http", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    // A link to anything else keeps its text and loses the link (span is not allowed).
    a: (tagName, attribs) =>
      /^(https?:\/\/|mailto:)/i.test(attribs.href ?? "")
        ? {
            tagName,
            attribs: {
              href: attribs.href ?? "",
              target: "_blank",
              rel: "nofollow noopener noreferrer",
            },
          }
        : { tagName: "span", attribs: {} },
    // Editors and pasted content use these for the same thing.
    b: "strong",
    i: "em",
    strike: "s",
    del: "s",
    h1: "h2",
    h4: "h3",
  },
};

/** A description ready to store or render: clean HTML, or "" when it says nothing. */
export function sanitizeRichText(value: string): string {
  const html = isRichText(value) ? value : plainTextToHtml(value);
  const EMPTY =
    /^(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)+|(\s*<p>\s*(<br\s*\/?>)?\s*<\/p>)+$/gi;
  // Empty paragraphs at either end (an emptied editor is just "<p></p>").
  return sanitizeHtml(html, OPTIONS).trim().replace(EMPTY, "").trim();
}
