import type { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { isSafeLinkUrl } from "@/lib/validation";
import { buildWhatsAppUrl, isValidWhatsAppNumber } from "@/lib/whatsapp";
import { findTrackableLink } from "@/server/analytics/ingest";
import {
  notFoundRedirect,
  trackedRedirect,
} from "@/server/analytics/track-redirect";

/**
 * Profile link click: record link_click, then send the visitor to the
 * destination. A "whatsapp" link opens a chat with the profile's number
 * from Settings and the link's prefilled message.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const link = /^[0-9a-f-]{36}$/.test(id)
    ? await findTrackableLink(getDb(), id)
    : null;

  if (!link || !link.isPublished) return notFoundRedirect(request);

  if (link.kind === "whatsapp") {
    const number = link.whatsappNumber;
    if (
      !link.isActive ||
      !link.message ||
      !number ||
      !isValidWhatsAppNumber(number)
    )
      return notFoundRedirect(request, `/${link.username}`);
    return trackedRedirect(request, buildWhatsAppUrl(number, link.message), {
      profileId: link.profileId,
      type: "link_click",
      linkId: link.id,
    });
  }

  // Inactive or unsafe links are not clickable: back to the profile, nothing recorded.
  if (
    !link.isActive ||
    link.kind !== "link" ||
    !link.url ||
    !isSafeLinkUrl(link.url)
  ) {
    return notFoundRedirect(request, `/${link.username}`);
  }
  return trackedRedirect(request, link.url, {
    profileId: link.profileId,
    type: "link_click",
    linkId: link.id,
  });
}
