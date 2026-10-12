import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";

export type { IconSvgElement };

/**
 * Hugeicons stroke-rounded glyphs for the public pages, at one stroke
 * weight so every icon reads the same. Size comes from className.
 */
export function Icon({
  icon,
  className,
  strokeWidth = 1.75,
}: {
  icon: IconSvgElement;
  className?: string;
  strokeWidth?: number;
}): ReactNode {
  return (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...(className ? { className } : {})}
    />
  );
}
