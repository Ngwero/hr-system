import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Authenticated HR data is scoped per user and organization.
  // A shared static shell would fight Row Level Security, so pages render
  // dynamically from the current session instead of Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
