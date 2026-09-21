import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/today", "/floor", "/dashboard", "/visits/", "/walk-in", "/customers/"] }],
    sitemap: "https://jadepink.com/sitemap.xml",
  };
}
