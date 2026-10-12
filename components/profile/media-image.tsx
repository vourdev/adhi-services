import type { ReactNode } from "react";

/**
 * Plain <img> for owner-supplied images. Uploads are already resized and
 * re-encoded to WebP on the server, and external https URLs cannot go
 * through next/image without listing every host, so the optimiser is not used.
 */
export function MediaImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  eager = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /** The page's main image (LCP): load first. */
  priority?: boolean;
  /** Above the fold but not the main image: load now, normal priority. */
  eager?: boolean;
}): ReactNode {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see component comment
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority || eager ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
