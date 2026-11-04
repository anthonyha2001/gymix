import type { MetadataRoute } from "next";

// Lets phones install Gymix as an app (home-screen icon, full screen, no browser bar).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gymix",
    short_name: "Gymix",
    description: "Your gym in your pocket: check in, train, book classes, chat with your coach.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f2",
    theme_color: "#0d1117",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
