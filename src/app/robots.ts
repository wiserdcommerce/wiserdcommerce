import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/marketplace", "/products/", "/stores/", "/community"],
      disallow: ["/api/", "/admin", "/account", "/checkout", "/orders", "/messages", "/wallet"],
    },
    sitemap: "/sitemap.xml",
  };
}
