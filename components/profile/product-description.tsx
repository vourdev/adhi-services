import type { ReactNode } from "react";

type Block =
  { kind: "text"; lines: string[] } | { kind: "list"; items: string[] };

const BULLET = /^\s*[-•*]\s+/;

/** Blank lines start a paragraph; lines starting with "-", "•" or "*" form a list. */
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const paragraph of text.trim().split(/\n\s*\n/)) {
    // Blocks never continue across a blank line.
    let current: Block | null = null;
    for (const raw of paragraph.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (BULLET.test(raw)) {
        const item = raw.replace(BULLET, "").trim();
        if (current?.kind === "list") current.items.push(item);
        else blocks.push((current = { kind: "list", items: [item] }));
      } else if (current?.kind === "text") current.lines.push(line);
      else blocks.push((current = { kind: "text", lines: [line] }));
    }
  }
  return blocks;
}

/**
 * A product description as the seller typed it: plain text only, with
 * paragraphs and simple lists made readable. No HTML or links are rendered.
 */
export function ProductDescription({ text }: { text: string }): ReactNode {
  return (
    <div className="flex flex-col gap-3.5 text-[15.5px] leading-relaxed text-p-fg/90">
      {toBlocks(text).map((block, index) =>
        block.kind === "text" ? (
          <p key={index} className="text-pretty">
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
        ) : (
          <ul key={index} className="flex flex-col gap-2">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-p-accent"
                />
                <span className="min-w-0 text-pretty">{item}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
