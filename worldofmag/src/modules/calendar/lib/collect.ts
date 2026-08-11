import { isoDay, type CalendarEvent, type CalendarModule } from "./index";
import type { CalendarContribEvent } from "@/platform/calendar";

/**
 * Z-150 / 049 — CZYSTE SKŁADANIE AGENDY.
 *
 * Do 049 była tu jedna `Promise.all` z dziewięcioma zapytaniami do tabel sześciu innych modułów.
 * Potem przez chwilę plik sięgał po korzeń kompozycji, żeby zebrać wkłady — i to była **odwrócona
 * zależność**: moduł pytał o listę wszystkich modułów. Kosztowało to 2–4× wolniejszą kompilację
 * każdej trasy, bo kontrakt Kalendarza (plik zbiorczy) jest importowany przez powłokę.
 *
 * Teraz zostało tu **wyłącznie to, co należy do modułu Kalendarz**: uporządkowanie zdarzeń.
 * Kto je zbiera, rozstrzyga `src/actions/calendarAgenda.ts`.
 */
export function assembleCalendar(wniesione: CalendarContribEvent[]): CalendarEvent[] {
  const events: CalendarEvent[] = wniesione.map((e) => ({ ...e, module: e.module as CalendarModule }));

  // Sortuj wg dnia, potem wg godziny (zdarzenia bez godziny na końcu dnia).
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.at && b.at) return a.at < b.at ? -1 : 1;
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });

  return events;
}

// `isoDay` bywa potrzebne konsumentom razem ze składaniem — reeksport, żeby nie mnożyć importów.
export { isoDay };
