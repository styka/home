import type { MetadataRoute } from "next";
import { APP_TITLE } from "@/lib/appName";

// Manifest PWA generowany dynamicznie — nazwa i ikony zależne od środowiska (master vs develop).
// Ikony mają przezroczyste tło, więc pomijamy purpose:"maskable" (maskowanie wyglądałoby źle).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_TITLE,
    short_name: APP_TITLE,
    description: "Personal management system",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    orientation: "portrait-primary",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
