import { Sprout, CalendarCheck, BookOpen, ClipboardList } from "lucide-react";
import { defineModule } from "@/platform/registry";

/**
 * 113 — deklaracja modułu Rośliny.
 *
 * Do tego pliku trafia **wyłącznie to, co wolno wysłać do przeglądarki**: `MODULES` importuje
 * `ModuleSidebar`, komponent kliencki. Wkład serwerowy (asystent, kalendarz) mieszka
 * w `module.server.ts` — rozdzielenie jest wymuszone i zmierzone (049).
 */
export default defineModule({
  id: "rosliny",
  label: "Rośliny",
  href: "/rosliny",
  permission: "module.rosliny",
  color: "var(--accent-green)",
  Icon: Sprout,
  sideNav: () => import("./ui/RoslinySideNav").then((m) => ({ default: m.RoslinySideNav })),
  szybkieCele: [
    { id: "przestrzenie", etykieta: "Przestrzenie", href: "/rosliny", Icon: Sprout },
    { id: "opieka", etykieta: "Opieka", href: "/rosliny/opieka", Icon: CalendarCheck },
    { id: "katalog", etykieta: "Katalog gatunków", href: "/rosliny/katalog", Icon: BookOpen },
    { id: "ewidencja", etykieta: "Ewidencja zabiegów", href: "/rosliny/ewidencja", Icon: ClipboardList },
  ],
  defaultEnabled: true,
});
