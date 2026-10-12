import type { MetadataRoute } from "next";

import { hasPublicSiteUrl, siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // Without a real public domain this is a development or preview deployment.
  if (!hasPublicSiteUrl())
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/go/", "/pesanan/", "/media/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
