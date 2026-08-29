import { prisma } from "@/platform/db/prisma";
import { ownedByWhere } from "@/platform/auth/ownership";
import type { CalendarContribEvent, CalendarRange } from "@/platform/calendar";
import { SUFIT_LISTY } from "@/platform/pagination";

/**
 * 114: wkład Kontaktów do wspólnej agendy — URODZINY.
 *
 * Najbardziej oczywista funkcja „lekkiego CRM": data siedzi na rekordzie (`Contact.birthday`),
 * a zdarzenie powtarza się co rok. Rocznicę liczymy dla roku początku i roku końca zakresu
 * (zakres agendy to miesiąc, więc obie wartości różnią się najwyżej o 1 — grudzień/styczeń).
 */

/** „YYYY-MM-DD" w czasie lokalnym — ten sam format klucza dnia co w siatce kalendarza. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const kontakty = await prisma.contact.findMany({
    take: SUFIT_LISTY,
    where: { ...(await ownedByWhere(userId)), birthday: { not: null } },
    select: { id: true, name: true, birthday: true },
  });

  const events: CalendarContribEvent[] = [];
  const lata = new Set([from.getFullYear(), to.getFullYear()]);
  for (const k of kontakty) {
    if (!k.birthday) continue;
    // Urodziny zapisujemy jako północ UTC dnia kalendarzowego — miesiąc/dzień czytamy więc w UTC.
    const m = k.birthday.getUTCMonth();
    const d = k.birthday.getUTCDate();
    for (const rok of lata) {
      // 29 lutego w roku nieprzestępnym JS przelewa na 1 marca — to akceptowalna konwencja.
      const rocznica = new Date(rok, m, d, 12, 0, 0, 0);
      if (rocznica >= from && rocznica < to) {
        events.push({
          id: `urodziny-${k.id}-${rok}`,
          module: "contacts",
          title: `🎂 Urodziny: ${k.name}`,
          date: isoDay(rocznica),
          at: null,
          href: "/contacts",
          accent: "var(--accent-green)",
        });
      }
    }
  }
  return events;
}
