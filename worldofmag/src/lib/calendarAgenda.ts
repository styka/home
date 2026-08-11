import { collectFromModules } from "@/lib/calendarContributors";
import { assembleCalendar, monthRange, type CalendarEvent } from "@/modules/calendar/contract";

/**
 * 049 — SKŁADANIE WSPÓLNEJ AGENDY: warstwa kompozycji, nie moduł Kalendarz.
 *
 * **Dlaczego to nie mieszka w module.** Agenda jest sumą wkładów siedmiu modułów, więc jej złożenie
 * wymaga listy wszystkich — a moduł nie ma prawa jej znać (C-36). Gdy `collect.ts` sięgał po korzeń
 * kompozycji, powstawała odwrócona zależność: moduł → korzeń → wszystkie moduły.
 *
 * **Koszt tej inwersji był realny i zmierzony.** Kontrakt to plik zbiorczy, więc re-eksport agregatu
 * sprawiał, że import **jednej stałej** z kontraktu Kalendarza (`MODULE_META` w `NotificationBell`,
 * czyli w powłoce obecnej na każdej stronie) wciągał cały kod serwerowy aplikacji. Graf strony
 * logowania urósł z 2120 do 2775 modułów, a kompilacja każdej trasy w trybie dev zwolniła 2–4×.
 * Po odwróceniu zależności graf spadł do 1771 — **poniżej** stanu sprzed przebudowy.
 *
 * To jest **zwykły moduł serwerowy, nie `"use server"`** — `userId` nie pochodzi od klienta, lecz
 * z sesji (akcja) albo z odwoływalnego tokenu feedu iCal (trasa). Sesyjną otoczkę dokłada
 * `src/actions/calendarAgenda.ts`.
 */
export async function collectCalendarEvents(userId: string, year: number, month0: number): Promise<CalendarEvent[]> {
  const { start, end } = monthRange(year, month0);
  return assembleCalendar(await collectFromModules(userId, { from: start, to: end }));
}
