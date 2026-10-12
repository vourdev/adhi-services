import type { ReactNode } from "react";

import { bioSegments } from "@/lib/bio-links";

/** The bio as plain text with its web addresses turned into links. */
export function BioText({
  text,
  linkClassName,
}: {
  text: string;
  linkClassName: string;
}): ReactNode {
  return bioSegments(text).map((segment, index) =>
    segment.kind === "text" ? (
      segment.text
    ) : (
      <a
        // Segments come from one string and never reorder.
        key={index}
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer me"
        className={linkClassName}
      >
        {segment.label}
      </a>
    )
  );
}
