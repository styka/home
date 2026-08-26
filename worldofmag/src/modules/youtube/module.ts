import { Youtube, Rss } from "lucide-react";
import { defineModule } from "@/platform/registry";

/**
 * 102 — deklaracja modułu YouTube.
 *
 * Do tego pliku trafia **wyłącznie to, co wolno wysłać do przeglądarki**: `MODULES` importuje
 * `ModuleSidebar`, komponent kliencki. Wkład serwerowy (asystent, zadania w tle) mieszka
 * w `module.server.ts` — rozdzielenie jest wymuszone i zmierzone (049).
 */
export default defineModule({
  id: "youtube",
  label: "YouTube",
  href: "/youtube",
  permission: "module.youtube",
  color: "var(--accent-red)",
  Icon: Youtube,
  szybkieCele: [
    { id: "filmy", etykieta: "Filmy", href: "/youtube", Icon: Youtube },
    { id: "kanaly", etykieta: "Kanały", href: "/youtube/kanaly", Icon: Rss },
  ],
  defaultEnabled: true,
});
