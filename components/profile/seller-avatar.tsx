import type { ReactNode } from "react";

import { MediaImage } from "./media-image";

const SIZES = {
  sm: { box: "size-7 text-[13px]", pixels: 56 },
  md: { box: "size-12 text-lg", pixels: 96 },
} as const;

/** The seller's photo, or their initial when there is none. */
export function SellerAvatar({
  name,
  src,
  size = "sm",
}: {
  name: string;
  src: string | null;
  size?: keyof typeof SIZES;
}): ReactNode {
  const { box, pixels } = SIZES[size];
  return src ? (
    <MediaImage
      src={src}
      alt=""
      width={pixels}
      height={pixels}
      eager
      className={`${box} shrink-0 rounded-full bg-p-line object-cover object-[50%_30%]`}
    />
  ) : (
    <span
      aria-hidden
      className={`${box} grid shrink-0 place-items-center rounded-full bg-p-fg font-bold text-p-bg`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
