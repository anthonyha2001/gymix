import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // Keep the dev-only badge clear of the sidebar's account section.
  devIndicators: { position: "bottom-right" },
  // The service worker must always be fresh, and only act for this site.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  experimental: {
    // Keep pages the user has opened in the browser for a while, so going back
    // to them (or switching tabs) is instant. Edits refresh the page anyway.
    staleTimes: { dynamic: 30, static: 300 },
    // Machine photos (max 5 MB, enforced by the storage bucket) are uploaded via a Server Action.
    serverActions: { bodySizeLimit: "6mb" },
  },
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
