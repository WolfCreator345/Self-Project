import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Staff paste cover image URLs from publishers / Open Library etc.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
