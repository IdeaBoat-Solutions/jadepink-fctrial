import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /* Tree-shake per-icon/per-module imports so shared chunks stay small. */
    optimizePackageImports: ["lucide-react", "recharts", "radix-ui"],
    /* Reuse fetched route data on repeat/back-forward navigations (seconds). */
    staleTimes: { dynamic: 30, static: 180 },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
