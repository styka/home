/**
 * Kontrakt modułu **Kalendarz** (jedna agenda zbierająca wydarzenia z wielu modułów).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/calendar/*` poza `contract`.
 *
 * Kalendarz **przestał być odwrotnością pozostałych modułów** (049). Do tej pory sam czytał cudze
 * dane — najpierw dziewięcioma zapytaniami do tabel sześciu modułów, potem przez korzeń kompozycji.
 * Oba warianty znaczyły to samo: moduł musiał znać wszystkie pozostałe.
 *
 * Teraz zostawia sobie **czyste składanie** (`assembleCalendar`), a zbieranie wkładów robi warstwa
 * kompozycji (`src/lib/calendarAgenda.ts`). **Agregatu celowo NIE MA w kontrakcie** — i to nie jest
 * drobiazg: kontrakt jest plikiem zbiorczym, więc jego re-eksport sprawiał, że import samej stałej
 * `MODULE_META` przez dzwonek powiadomień (powłoka, każda strona) wciągał do grafu cały kod
 * serwerowy aplikacji. Graf strony logowania: 2775 → 1771 modułów po usunięciu.
 *
 * | Konsument | Czego potrzebuje |
 * |---|---|
 * | warstwa kompozycji agendy | `assembleCalendar`, `monthRange` |
 * | trasa kanału iCal (`/api/calendar/ical`) | `buildICalendar` |
 * | **dzwonek powiadomień** (powłoka) | `MODULE_META`, typ `CalendarModule` |
 * | `actions/notifications` | `isoDay` |
 * | ustawienia konta | karta kanału iCal (widok — patrz uwaga niżej) |
 *
 * **`MODULE_META` i `isoDay` są w kontrakcie świadomie**, mimo że to dane i helper z `lib/`.
 * Dzwonek powiadomień musi wiedzieć, jaką ikoną i kolorem opisać wydarzenie z danego modułu, a
 * powiadomienia liczą „dziś" tą samą regułą co agenda. Alternatywą byłoby zdublowanie obu w powłoce
 * — czyli dokładnie ten rozjazd, którego granica ma nie dopuścić.
 *
 * **`IcalFeedCard` jest wyjątkiem tej samej klasy co nawigacja boczna:** kontrakt opisuje dane, nie
 * ekrany, więc karta kanału iCal na stronie ustawień importowana jest wprost z `ui/`. Ustawienia
 * konta nie są modułem z rejestru, tylko powierzchnią konta — nazwane w dzienniku, nie przemilczane.
 */


export { assembleCalendar } from "./lib/collect";
export { buildICalendar } from "./lib/ical";

export { isoDay, monthRange, MODULE_META } from "./lib/index";
export type { CalendarEvent, CalendarModule } from "./lib/index";
