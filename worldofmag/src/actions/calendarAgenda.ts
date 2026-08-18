"use server";

import { requireAuth } from "@/platform/auth/serverUtils";
import { cachowanaAgenda } from "@/lib/cacheAgregatow";
import type { CalendarEvent } from "@/modules/calendar/contract";

/**
 * Sesyjna otoczka nad agregatem agendy (rdzeń: `@/lib/calendarAgenda`, cookie-free, reużywany
 * przez feed iCal autoryzowany tokenem). Powód, dla którego składanie leży w warstwie kompozycji,
 * a nie w module Kalendarz — patrz komentarz przy rdzeniu.
 *
 * **085 (zadanie 29): cache przeniesiony do `@/lib/cacheAgregatow`.** Do tej pory był tu sam TTL 60 s
 * — czyli agenda potrafiła być nieaktualna przez minutę PO KAŻDEJ zmianie, także własnej
 * („dodałem zadanie i nie ma go w kalendarzu"). Teraz w kluczu jest stempel przestrzeni, więc
 * zmiana ogłaszająca zdarzenie unieważnia wpis natychmiast i we wszystkich instancjach; TTL zostaje
 * jako siatka na mutacje, które zdarzenia nie ogłaszają.
 */
export async function getCalendarEvents(year: number, month0: number): Promise<CalendarEvent[]> {
  const user = await requireAuth(); // sesja/cookies POZA cache (inaczej Next rzuca w unstable_cache)
  return cachowanaAgenda(user.id, year, month0);
}
