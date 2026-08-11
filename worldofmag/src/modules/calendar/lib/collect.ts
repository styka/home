import { monthRange, type CalendarEvent, type CalendarModule } from "./index";
import { collectFromModules } from "@/lib/calendarContributors";

/**
 * Z-150: rdzeń agregacji kalendarza dla KONKRETNEGO usera (bez `requireAuth`).
 * Wyodrębniony z `actions/calendar.ts`, by mógł go użyć też feed iCal (auth tokenem,
 * bez sesji). To zwykły moduł serwerowy (NIE "use server") — `userId` nie pochodzi
 * od klienta, lecz z sesji (akcja) albo z odwoływalnego tokenu feedu (route).
 *
 * **049: moduł Kalendarz nie sięga już do tabel sześciu innych modułów.** Wcześniej była tu
 * jedna `Promise.all` z dziewięcioma zapytaniami i dziewięć pętli mapujących — formalnie zgodne
 * z granicą (Prisma to nie moduł), ale znaczące dokładnie to samo: dodanie modułu ze zdarzeniami
 * wymagało edycji tego pliku. Teraz każdy moduł wnosi swoje zdarzenia przez pole `calendar`
 * w deklaracji, a tutaj zostaje **wyłącznie składanie i sortowanie**.
 */
export async function collectCalendarEvents(userId: string, year: number, month0: number): Promise<CalendarEvent[]> {
  const { start, end } = monthRange(year, month0);
  const wniesione = await collectFromModules(userId, { from: start, to: end });

  // `module` z wkładu jest identyfikatorem modułu; typ agendy zawęża go do znanych wartości.
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
