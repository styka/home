import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds, ownedOrAsync } from "@/platform/auth/serverUtils";
import type { CalendarContribEvent, CalendarRange } from "@/platform/calendar";

/**
 * 049: wkład tego modułu do wspólnej agendy kalendarza.
 *
 * Zapytanie i mapowanie są **przeniesione bez zmiany** z `collectCalendarEvents` — te same `where`,
 * ten sam `select`, te same identyfikatory zdarzeń i te same adresy. Zmienia się wyłącznie to, kto
 * jest właścicielem kodu: dotąd moduł Kalendarz sięgał do tabel sześciu innych modułów.
 */

/** „YYYY-MM-DD" w czasie lokalnym — ten sam format klucza dnia co w siatce kalendarza. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function ownScope(userId: string) {
  return (await ownedOrAsync(userId));
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const cards = await prisma.vocabulary.findMany({
    where: { dueAt: { gte: from, lt: to }, deck: { is: { OR: await ownScope(userId) } } },
    select: { id: true, dueAt: true, deckId: true, deck: { select: { name: true } } },
  });

  // Powtórki SRS: zgrupuj fiszki per talia+dzień, by nie zalać kalendarza pojedynczymi słówkami.
  const byKey = new Map<string, { deckId: string; deck: string; date: string; count: number }>();
  for (const card of cards) {
    const date = isoDay(card.dueAt);
    const key = `${card.deckId}-${date}`;
    const entry = byKey.get(key);
    if (entry) entry.count += 1;
    else byKey.set(key, { deckId: card.deckId, deck: card.deck?.name ?? "Talia", date, count: 1 });
  }
  return Array.from(byKey.values()).map((g) => ({
    id: `srs-${g.deckId}-${g.date}`,
    module: "languages",
    title: `Powtórka: ${g.deck} (${g.count})`,
    date: g.date,
    at: null,
    href: "/languages",
    accent: "var(--accent-purple)",
  }));
}
