"use server";

import { requireAuth } from "@/lib/server-utils";
import { collectCalendarEvents } from "@/lib/calendar/collect";
import type { CalendarEvent } from "@/lib/calendar";

/**
 * Agreguje zdarzenia z wielu modułów (zadania, plan posiłków, zdrowie, leki,
 * przeglądy floty, opieka nad zwierzętami, powtórki SRS, usługi) w jeden widok
 * kalendarza dla zalogowanego usera. Rdzeń (Z-150) w `@/lib/calendar/collect`
 * (reużywany przez feed iCal, który auth tokenem, nie sesją).
 */
export async function getCalendarEvents(year: number, month0: number): Promise<CalendarEvent[]> {
  const user = await requireAuth();
  return collectCalendarEvents(user.id, year, month0);
}
