/**
 * Kontrakt modułu **Kalendarz** (jedna agenda zbierająca wydarzenia z wielu modułów).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/calendar/*` poza `contract`.
 *
 * Kalendarz jest **odwrotnością** pozostałych modułów: nie tyle jest wołany, ile sam czyta cudze
 * dane. Jego kontrakt jest przez to mały, ale konsumenci są nietypowi:
 *
 * | Konsument | Czego potrzebuje |
 * |---|---|
 * | narzędzia odczytu asystenta, poranny briefing | `getCalendarEvents` |
 * | trasa kanału iCal (`/api/calendar/ical`) | `collectCalendarEvents`, `buildICalendar` |
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

export { getCalendarEvents } from "./actions/calendar";

export { collectCalendarEvents } from "./lib/collect";
export { buildICalendar } from "./lib/ical";

export { isoDay, monthRange, MODULE_META } from "./lib/index";
export type { CalendarEvent, CalendarModule } from "./lib/index";
