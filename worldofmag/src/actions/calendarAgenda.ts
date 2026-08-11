"use server";

import { unstable_cache } from "next/cache";
import { requireAuth } from "@/platform/auth/serverUtils";
import { collectCalendarEvents } from "@/lib/calendarAgenda";
import type { CalendarEvent } from "@/modules/calendar/contract";

/**
 * Sesyjna otoczka nad agregatem agendy (rdzeń: `@/lib/calendarAgenda`, cookie-free, reużywany
 * przez feed iCal autoryzowany tokenem). Powód, dla którego składanie leży w warstwie kompozycji,
 * a nie w module Kalendarz — patrz komentarz przy rdzeniu.
 */
export async function getCalendarEvents(year: number, month0: number): Promise<CalendarEvent[]> {
  const user = await requireAuth(); // sesja/cookies POZA cache (inaczej Next rzuca w unstable_cache)
  // Z-072: krótki TTL (60 s) + klucz PER-USER odciąża bazę z powtarzalnej, ciężkiej agregacji
  // wielomodułowej. `user.id` w kluczu cache = brak przecieku między użytkownikami.
  const cached = unstable_cache(
    async () => collectCalendarEvents(user.id, year, month0),
    ["calendar-events", user.id, String(year), String(month0)],
    { revalidate: 60, tags: [`calendar:${user.id}`] },
  );
  return cached();
}
