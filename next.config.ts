import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating "N" dev indicator; compile/runtime errors still surface.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Pin the root: a stray package-lock.json in a parent folder would otherwise be picked up.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
