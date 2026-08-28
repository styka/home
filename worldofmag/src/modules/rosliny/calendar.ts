import { prisma } from "@/platform/db/prisma";
import { ownedOrAsync } from "@/platform/auth/serverUtils";
import type { CalendarContribEvent, CalendarRange } from "@/platform/calendar";
import { SUFIT_LISTY } from "@/platform/pagination";

/**
 * 113 — wkład modułu Rośliny do wspólnej agendy (AC-12).
 *
 * Do kalendarza trafiają **zaplanowane zabiegi**, nie zdarzenia, które już się odbyły: agenda
 * odpowiada na pytanie „co mnie czeka", a historia ma własne miejsce w widoku rośliny.
 *
 * Zakres bierzemy przez własność PRZESTRZENI, a nie zadania: `PlantCareTask` nie ma własnej
 * kolumny przestrzeni (wisi na `PlantSpace`), więc pytanie o nią byłoby pytaniem o pole, którego
 * ta tabela nie ma — dokładnie ten błąd łapie bramka `check:owner-columns`.
 */

/** „YYYY-MM-DD" w czasie lokalnym — ten sam format klucza dnia co w siatce kalendarza. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function calendarEvents(
  userId: string,
  { from, to }: CalendarRange,
): Promise<CalendarContribEvent[]> {
  const zadania = await prisma.plantCareTask.findMany({
    take: SUFIT_LISTY,
    where: {
      active: true,
      nextDueAt: { gte: from, lt: to },
      space: { is: { OR: await ownedOrAsync(userId) } },
    },
    select: {
      id: true,
      title: true,
      nextDueAt: true,
      spaceId: true,
      plantId: true,
      plant: { select: { name: true } },
    },
  });

  const events: CalendarContribEvent[] = [];
  for (const z of zadania) {
    if (!z.nextDueAt) continue;
    events.push({
      id: `roslinyopieka-${z.id}`,
      module: "rosliny",
      title: `${z.title}${z.plant?.name ? ` — ${z.plant.name}` : ""}`,
      date: isoDay(z.nextDueAt),
      at: z.nextDueAt.toISOString(),
      // Kierujemy do rośliny, gdy zadanie jej dotyczy, a do przestrzeni, gdy dotyczy grządki albo
      // całej uprawy — inaczej połowa pozycji prowadziłaby donikąd.
      href: z.plantId ? `/rosliny/${z.spaceId}/roslina/${z.plantId}` : `/rosliny/${z.spaceId}`,
      accent: "var(--accent-green)",
    });
  }
  return events;
}
