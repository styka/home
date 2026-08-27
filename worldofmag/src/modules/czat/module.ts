import { MessageCircle, MessageSquarePlus } from "lucide-react";
import { defineModule } from "@/platform/registry";

/**
 * 107 — deklaracja modułu **Czat**.
 *
 * Nazwa „Wiadomości” jest w Omnii zajęta przez moduł newsów, a dwa moduły o tej samej nazwie
 * w nawigacji byłyby dokładnie tą niespójnością, którą to zgłoszenie każe usunąć — stąd „Czat”
 * i trasa `/czat`.
 *
 * Do tego pliku trafia **wyłącznie to, co wolno wysłać do przeglądarki**: `MODULES` importuje
 * `ModuleSidebar`, komponent kliencki. Moduł nie ma wkładu serwerowego (nie wnosi akcji
 * asystenta ani zadań w tle — prywatna korespondencja to nie jest dobre pierwsze miejsce na
 * automat), więc nie ma `module.server.ts`.
 */
export default defineModule({
  id: "czat",
  label: "Czat",
  href: "/czat",
  permission: "module.czat",
  color: "var(--accent-green)",
  Icon: MessageCircle,
  szybkieCele: [
    { id: "rozmowy", etykieta: "Rozmowy", href: "/czat", Icon: MessageCircle },
    { id: "nowa", etykieta: "Nowa rozmowa", href: "/czat?akcja=nowa", Icon: MessageSquarePlus },
  ],
  defaultEnabled: true,
});
