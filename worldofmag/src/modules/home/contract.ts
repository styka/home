/**
 * Kontrakt modułu **Strona główna** (pulpit: kafelki modułów, migawka dnia, szybkie akcje,
 * ostatnio używane, briefing).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/home/*` poza `contract`.
 *
 * Kontrakt eksportuje **wyłącznie typy**, bo pulpit nie ma zewnętrznego konsumenta danych: to on
 * czyta kontrakty **innych** modułów (Kuchnia, Flota, Zdrowie, Portfel, Magazynowanie, Nauka
 * języków, Zwierzęta), a nie odwrotnie. Kontrakt istnieje jako **granica**, nie jako spis życzeń —
 * tak samo jak przy Trasach TIR w 046 i Usługach w tej fali.
 *
 * **Co świadomie NIE jest częścią tego modułu:** globalny asystent (`components/assistant/`) oraz
 * feed aktywności (`components/settings/`). Pierwszy jest elementem powłoki montowanym na każdej
 * stronie, drugi należy do ustawień konta. Oba mieszkały wcześniej w `components/home/` i zostały
 * stamtąd wyprowadzone **osobnym commitem** — bez tego rozdzielenia powłoka musiałaby importować
 * wnętrze modułu.
 */

/** Sekcja pulpitu — kolejność i widoczność zapisuje `DashboardPref` (per użytkownik). */
export type DashboardSectionId =
  | "briefing"
  | "quickActions"
  | "todaySnapshot"
  | "moduleSnapshot"
  | "recentlyUsed"
  | "suggestions";
