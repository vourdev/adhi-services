import type { ReactNode } from "react";

import { sanitizeRichText } from "@/server/rich-text";

/**
 * A product description: HTML from the editor, or older plain text turned
 * into paragraphs and lists. Cleaned again here with the same allowlist as
 * on save, so only the editor's formatting can ever reach the page.
 * Server component (the sanitizer stays on the server).
 */
export function ProductDescription({ text }: { text: string }): ReactNode {
  return (
    <div
      className="rich-text text-[15px] text-p-fg/85"
      // Sanitized just above: tags and link targets limited to the editor's.
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(text) }}
    />
  );
}
