import { prisma } from "@/platform/db/prisma";
import { ownedOrAsync } from "@/platform/auth/serverUtils";
import type { CalendarContribEvent, CalendarRange } from "@/platform/calendar";
import { SUFIT_LISTY } from "@/platform/pagination";
import { normalizeDays } from "./domain/harmonogram";

/**
 * Wkład Nawyków do wspólnej agendy. Dane pod zdarzenia istniały od dawna (`daysOfWeek`,
 * `reminderTime` — znormalizowane w `domain/harmonogram`), ale moduł był niewidoczny w kalendarzu.
 *
 * Dwie świadome decyzje kształtu:
 * - **Jedno zdarzenie na DZIEŃ, nie na nawyk.** Ktoś z pięcioma codziennymi nawykami dostałby
 *   155 pozycji w miesiącu — siatka miesiąca stałaby się listą nawyków. Agregat per dzień
 *   (jak powtórki SRS per talia) mówi to, co kalendarz ma powiedzieć: „tego dnia coś na mnie czeka".
 * - **Liczymy POZOSTAŁE, nie zaplanowane.** Agenda odpowiada na pytanie „co mnie czeka" (ta sama
 *   reguła co wkład Roślin) — nawyk odhaczony danego dnia już nie czeka, więc dzień w całości
 *   odhaczony nie ma zdarzenia. Nawyki z celem TYGODNIOWYM (`weeklyGoal`) pomijamy: nie mają
 *   przypisanych dni, więc każda data byłaby zmyślona.
 */

/** „YYYY-MM-DD" w czasie lokalnym — ten sam format klucza dnia co w siatce kalendarza. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function etykieta(n: number): string {
  if (n === 1) return "1 nawyk do odhaczenia";
  const koncowka = n >= 2 && n <= 4 ? "nawyki" : "nawyków";
  return `${n} ${koncowka} do odhaczenia`;
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const habits = await prisma.habit.findMany({
    take: SUFIT_LISTY,
    where: { archived: false, weeklyGoal: null, OR: await ownedOrAsync(userId) },
    select: { id: true, daysOfWeek: true },
  });
  if (habits.length === 0) return [];

  // `HabitEntry.date` to string "YYYY-MM-DD", więc porównanie leksykograficzne = porównanie dat.
  const entries = await prisma.habitEntry.findMany({
    take: SUFIT_LISTY,
    where: { habitId: { in: habits.map((h) => h.id) }, date: { gte: isoDay(from), lt: isoDay(to) } },
    select: { habitId: true, date: true },
  });
  const done = new Set(entries.map((e) => `${e.habitId}:${e.date}`));

  const events: CalendarContribEvent[] = [];
  const day = new Date(from);
  // Zakres agendy to miesiąc (±ogony siatki); twardy sufit iteracji na wypadek dziwnego zakresu.
  for (let i = 0; day < to && i < 62; i++) {
    const date = isoDay(day);
    const dow = day.getDay(); // 0=niedziela … 6=sobota — ta sama konwencja co `daysOfWeek`
    let remaining = 0;
    for (const h of habits) {
      const days = normalizeDays(h.daysOfWeek);
      const scheduled = days == null || days.split(",").includes(String(dow));
      if (scheduled && !done.has(`${h.id}:${date}`)) remaining += 1;
    }
    if (remaining > 0) {
      events.push({
        id: `habits-${date}`,
        module: "habits",
        title: etykieta(remaining),
        date,
        at: null,
        href: "/habits",
        accent: "var(--accent-orange)",
      });
    }
    day.setDate(day.getDate() + 1);
  }
  return events;
}
