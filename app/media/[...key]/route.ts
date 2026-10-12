import { NextResponse } from "next/server";

import { openPublicMedia } from "@/server/storage";

/** Uploaded, already-processed images. Keys are random and never reused, so they cache forever. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const media = await openPublicMedia(key.join("/"));
  if (!media) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(media.stream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(media.size),
      // s-maxage lets the hosting CDN keep it too, so a Blob read happens once per edge.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
