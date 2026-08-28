import { prisma } from "@/platform/db/prisma";
import { terminCykliczny, terminPodlewania, type PrognozaDobowa, type WynikTerminu } from "../domain/harmonogram";
import { czytajWymaganiaWodne } from "../domain/agenda";
import { prognozaDlaPrzestrzeni } from "./pogoda";
import type { Naslonecznienie } from "./typy";

/**
 * 113 — ZŁOŻENIE REGUŁY TERMINU Z DANYMI Z BAZY.
 *
 * Reguła (`domain/harmonogram`) jest czysta i nic nie wie o Prismie; ten plik dostarcza jej faktów.
 *
 * **Dlaczego to NIE mieszka w pliku akcji.** Termin liczą dwa różne miejsca: odnotowanie zabiegu
 * (`actions/opieka`) i założenie pierwszego harmonogramu przy nowej roślinie (`actions/rosliny`).
 * Gdyby funkcja została w jednym z nich, drugie musiałoby ją zaimportować — a to jest cykl między
 * dwoma plikami `"use server"`, które i tak importują się nawzajem po guardy. Wspólny, zwykły moduł
 * usuwa cykl i przy okazji gwarantuje, że **pierwszy termin liczy się dokładnie tą samą regułą co
 * każdy następny** (inaczej roślina dodana w lipcu dostałaby zimowy odstęp).
 */

export async function przeliczTermin(taskId: string, od: Date): Promise<WynikTerminu> {
  const zadanie = await prisma.plantCareTask.findUnique({
    where: { id: taskId },
    select: {
      kind: true,
      recurring: true,
      space: { select: { kind: true, weatherLocationId: true } },
      place: { select: { sun: true } },
      plant: {
        select: {
          place: { select: { sun: true } },
          species: { select: { waterJson: true } },
        },
      },
    },
  });
  if (!zadanie) throw new Error("Zadanie opieki nie istnieje");

  const naslonecznienie: Naslonecznienie =
    (zadanie.place?.sun as Naslonecznienie) ?? (zadanie.plant?.place?.sun as Naslonecznienie) ?? "unknown";
  const prognoza: PrognozaDobowa[] = await prognozaDlaPrzestrzeni(zadanie.space.weatherLocationId);
  // Deszcz nie podleje rośliny stojącej w mieszkaniu — to jedyne miejsce, w którym tryb przestrzeni
  // wpływa na regułę, a nie tylko na wygląd.
  const podDachem = zadanie.space.kind === "home";

  if (zadanie.kind === "WATERING") {
    return terminPodlewania({
      od,
      wymagania: czytajWymaganiaWodne(zadanie.plant?.species?.waterJson),
      naslonecznienie,
      prognoza,
      podDachem,
    });
  }

  // Zabieg niebędący podlewaniem: odstęp z reguły powtarzalności, a gdy jej nie ma — 14 dni,
  // bo to najczęstszy rytm nawożenia i przeglądu.
  let coIle = 14;
  try {
    const rec = zadanie.recurring ? (JSON.parse(zadanie.recurring) as { interval?: number }) : null;
    if (rec?.interval && rec.interval > 0) coIle = rec.interval;
  } catch {
    /* uszkodzona reguła = wartość domyślna, nie awaria agendy */
  }
  return terminCykliczny(od, coIle, { prognoza, podDachem });
}

/**
 * Zakłada pierwszy harmonogram podlewania dla nowo dodanej rośliny (AC-8).
 *
 * **Domyślnie podlewanie i tylko ono.** Nawożenie, przycinanie czy przesadzanie zależą od gatunku
 * i od tego, co użytkownik w ogóle robi — zakładanie ich „na zapas" dałoby nowej roślinie cztery
 * zadania, z których trzy zaraz wylądowałyby w zaległych. Podlewanie jest jedynym zabiegiem,
 * którego brak zabija roślinę.
 *
 * Cichy brak zamiast wyjątku: nieudane założenie harmonogramu nie może cofnąć **dodania rośliny**,
 * bo to użytkownik właśnie zrobił. Roślina bez harmonogramu jest w porządku; brak rośliny nie.
 */
export async function zalozHarmonogramPodlewania(plantId: string): Promise<void> {
  try {
    const roslina = await prisma.plant.findUnique({
      where: { id: plantId },
      select: { spaceId: true, placeId: true, name: true },
    });
    if (!roslina) return;

    const zadanie = await prisma.plantCareTask.create({
      data: {
        spaceId: roslina.spaceId,
        plantId,
        placeId: roslina.placeId,
        kind: "WATERING",
        title: "Podlewanie",
      },
      select: { id: true },
    });

    const wynik = await przeliczTermin(zadanie.id, new Date());
    await prisma.plantCareTask.update({
      where: { id: zadanie.id },
      data: { nextDueAt: wynik.termin, reason: wynik.uzasadnienie },
    });
  } catch {
    /* patrz nagłówek: brak harmonogramu jest dopuszczalny, brak rośliny nie */
  }
}
