import { prisma } from "@/platform/db/prisma";
import { terminCykliczny, terminDoZapisu, terminPodlewania, type PrognozaDobowa, type WynikTerminu } from "../domain/harmonogram";
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
 * Termin podlewania policzony **z danych rośliny**, bez istniejącego zadania opieki.
 *
 * Ta sama reguła i ten sam zestaw faktów co w `przeliczTermin` — różni się wyłącznie tym, skąd
 * bierze gatunek, miejsce i przestrzeń. Istnieje, żeby dało się zapytać „czy ten gatunek jest teraz
 * w ogóle podlewany na cykl" PRZED założeniem zadania.
 */
export async function terminPodlewaniaRosliny(plantId: string, od = new Date()): Promise<WynikTerminu | null> {
  const roslina = await prisma.plant.findUnique({
    where: { id: plantId },
    select: {
      space: { select: { kind: true, weatherLocationId: true } },
      place: { select: { sun: true } },
      species: { select: { waterJson: true } },
    },
  });
  if (!roslina) return null;

  return terminPodlewania({
    od,
    wymagania: czytajWymaganiaWodne(roslina.species?.waterJson),
    naslonecznienie: (roslina.place?.sun as Naslonecznienie) ?? "unknown",
    prognoza: await prognozaDlaPrzestrzeni(roslina.space.weatherLocationId),
    podDachem: roslina.space.kind === "home",
  });
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
 *
 * **Zadania nie dostaje wyłącznie gatunek bez cyklu podlewania w ŻADNEJ porze** — zboża i uprawy
 * polowe, których nawadnianie jest decyzją agrotechniczną, a nie odstępem między podlaniami. Reguła
 * mówi to wprost (`pomijac`), a my liczymy termin PRZED utworzeniem wiersza, żeby taki wiersz
 * w ogóle nie powstał.
 *
 * **Zero w bieżącej porze przy dodatniej innej to NIE jest ten przypadek.** Pomidor dodany
 * w styczniu ma prawdziwą datę następnego podlania — 1 marca — i dostaje zadanie z tą datą; po
 * prostu czeka. Wcześniej obie sytuacje szły pod jedną flagą i 125 ze 182 wpisów katalogu nie
 * dostawało zadania nigdy, bez śladu w interfejsie.
 *
 * Gatunek bez cyklu nie zostaje przez to bez możliwości opieki: zadanie zakłada się wtedy ręcznie,
 * przyciskiem „Dodaj zadanie opieki" w szczegółach rośliny (`createCareTask`, które tę samą flagę
 * czyta i nie wymyśla wtedy terminu).
 */
export async function zalozHarmonogramPodlewania(plantId: string): Promise<void> {
  try {
    const roslina = await prisma.plant.findUnique({
      where: { id: plantId },
      select: { spaceId: true, placeId: true, name: true },
    });
    if (!roslina) return;

    // Termin liczymy z danych rośliny, zanim powstanie wiersz zadania: `przeliczTermin` potrzebuje
    // wyłącznie gatunku, miejsca i przestrzeni, a utworzenie zadania „na próbę" i skasowanie go po
    // odczytaniu `pomijac` zostawiałoby dziurę w numeracji i ślad w dzienniku zmian.
    const wynik = await terminPodlewaniaRosliny(plantId);
    if (!wynik || wynik.pomijac) return;

    await prisma.plantCareTask.create({
      data: {
        spaceId: roslina.spaceId,
        plantId,
        placeId: roslina.placeId,
        kind: "WATERING",
        title: "Podlewanie",
        ...terminDoZapisu(wynik),
      },
      select: { id: true },
    });
  } catch {
    /* patrz nagłówek: brak harmonogramu jest dopuszczalny, brak rośliny nie */
  }
}
