"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { sprawdzWskazania, zakresPrzestrzeni } from "../lib/sharingGuard";
import { assertSpaceAccess } from "./przestrzenie";
import { assertPlantAccess } from "./rosliny";
import { przeliczTermin } from "../lib/terminy";
import { kubelekAgendy } from "../domain/agenda";
import { terminDoZapisu } from "../domain/harmonogram";
import { userDayBounds } from "@/lib/userTime";
import type { RodzajZabiegu, WynikZabiegu } from "../lib/typy";

/**
 * 113 — HARMONOGRAM OPIEKI I ZDARZENIA-ZABIEGI.
 *
 * Wzorzec wprost ze Zwierząt (`PetCareTask` + `PetCareLog`): harmonogram mówi „co i kiedy",
 * zdarzenie mówi „co się faktycznie stało". Różnica wobec Zwierząt jest jedna, ale istotna:
 * **termin nie jest tu stałą z reguły powtarzalności, tylko wynikiem reguły dziedzinowej**
 * (`domain/harmonogram`), która bierze pod uwagę gatunek, miejsce, porę roku i prognozę — i zwraca
 * termin RAZEM z uzasadnieniem.
 *
 * **Termin przelicza się od FAKTYCZNEGO wykonania, nie od planowanego.** Inaczej roślina podlana
 * trzy dni po terminie dostawałaby kolejny termin już za dzień — i harmonogram po tygodniu
 * składałby się wyłącznie z zaległości, czyli przestałby być czytany (AC-10).
 */

export interface PozycjaAgendy {
  id: string;
  spaceId: string;
  spaceName: string;
  plantId: string | null;
  plantName: string | null;
  placeName: string | null;
  kind: RodzajZabiegu;
  title: string;
  nextDueAt: string | null;
  /** Jednozdaniowe uzasadnienie terminu (AC-9). */
  reason: string | null;
  /** `OVERDUE` | `TODAY` | `SOON` — do grupowania w widoku. */
  bucket: "OVERDUE" | "TODAY" | "SOON";
}

const MS_DZIEN = 86_400_000;

/**
 * Agenda opieki ze WSZYSTKICH przestrzeni użytkownika.
 *
 * Zakres bierzemy przez własność przestrzeni, a nie przez własność zadania: `PlantCareTask` nie ma
 * własnej przestrzeni (wisi na `PlantSpace`), więc pytanie o nią byłoby pytaniem o kolumnę, której
 * ta tabela nie ma — dokładnie ten błąd łapie bramka `check:owner-columns`.
 */
export async function getCareAgenda(opts?: {
  spaceId?: string;
  dni?: number;
  /**
   * Dolna granica okna. Domyślnie **brak** — agenda musi pokazywać zaległe, bo po to istnieje.
   * Wołający, któremu zaległe nie są potrzebne (powiadomienia mówią o tym, co nadchodzi), podaje
   * ją jawnie: bez niej `take` wypełniłby się zaległościami i o nadchodzącym zabiegu nikt by się
   * nie dowiedział.
   */
  od?: Date;
}): Promise<PozycjaAgendy[]> {
  const user = await requireAuth();
  const teraz = new Date();
  // Koniec doby liczony w strefie UŻYTKOWNIKA (ciasteczko `tz`), nie procesu — na Renderze proces
  // stoi w UTC, więc wieczorem czasu polskiego „dziś" kończyło się dwie godziny za wcześnie.
  const { end: koniecDnia } = userDayBounds();
  const horyzont = new Date(teraz.getTime() + (opts?.dni ?? 7) * MS_DZIEN);

  const zadania = await prisma.plantCareTask.findMany({
    take: SUFIT_LISTY,
    where: {
      active: true,
      nextDueAt: { ...(opts?.od ? { gte: opts.od } : {}), lte: horyzont },
      space: { is: { ...(await zakresPrzestrzeni(user.id)), ...(opts?.spaceId ? { id: opts.spaceId } : {}) } },
    },
    select: {
      id: true,
      spaceId: true,
      plantId: true,
      kind: true,
      title: true,
      nextDueAt: true,
      reason: true,
      space: { select: { name: true } },
      plant: { select: { name: true } },
      place: { select: { name: true } },
    },
    orderBy: [{ nextDueAt: "asc" }],
  });

  return zadania.map((z) => ({
    id: z.id,
    spaceId: z.spaceId,
    spaceName: z.space.name,
    plantId: z.plantId,
    plantName: z.plant?.name ?? null,
    placeName: z.place?.name ?? null,
    kind: z.kind as RodzajZabiegu,
    title: z.title,
    nextDueAt: z.nextDueAt?.toISOString() ?? null,
    reason: z.reason,
    bucket: kubelekAgendy(z.nextDueAt, teraz, koniecDnia),
  }));
}

export async function createCareTask(data: {
  spaceId: string;
  title: string;
  kind?: RodzajZabiegu;
  plantId?: string | null;
  placeId?: string | null;
  recurring?: string | null;
  startAt?: Date | null;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertSpaceAccess(data.spaceId, user.id, true);

  const tytul = data.title?.trim();
  if (!tytul) throw new Error("Tytuł zadania jest wymagany");

  // Bez tego dałoby się założyć zadanie we WŁASNEJ przestrzeni wskazujące CUDZĄ roślinę, a przez nie
  // dopisać zdarzenie z jej `plantId` — które trafiłoby potem do kontekstu diagnozy ofiary.
  await sprawdzWskazania(user.id, { spaceId: data.spaceId, plantId: data.plantId, placeId: data.placeId });

  const zadanie = await prisma.plantCareTask.create({
    data: {
      spaceId: data.spaceId,
      plantId: data.plantId ?? null,
      placeId: data.placeId ?? null,
      kind: data.kind ?? "WATERING",
      title: tytul,
      recurring: data.recurring ?? null,
    },
    select: { id: true },
  });

  // Pierwszy termin liczymy tą samą regułą co każdy następny — inaczej zadanie zakładane w lipcu
  // dostałoby zimowy odstęp, i to bez uzasadnienia, które by to wyjaśniło.
  const wynik = await przeliczTermin(zadanie.id, data.startAt ?? new Date());
  await prisma.plantCareTask.update({
    where: { id: zadanie.id },
    // `pomijac` znaczy „nie ma czego zaplanować": podlewanie dodane ręcznie przy pszenicy nie
    // dostaje wymyślonej daty. Zadanie zostaje — użytkownik świadomie je założył i może podlać
    // ręcznie — ale bez terminu, za to z uzasadnieniem, które to tłumaczy.
    data: terminDoZapisu(wynik),
  });

  revalidatePath("/rosliny/opieka");
  revalidatePath(`/rosliny/${data.spaceId}`);
  return zadanie;
}

export interface ZadanieOpiekiDTO {
  id: string;
  kind: RodzajZabiegu;
  title: string;
  /** `null` = zadanie bez zaplanowanego terminu (gatunek bez cyklu podlewania). */
  nextDueAt: string | null;
  reason: string | null;
  active: boolean;
}

/**
 * Zadania opieki JEDNEJ rośliny — także te bez terminu i te wyłączone.
 *
 * Agenda pokazuje wyłącznie zadania z terminem w horyzoncie, więc zadanie bez daty (gatunek bez
 * cyklu) albo z terminem za pół roku było w niej niewidoczne — a więc niemożliwe do cofnięcia
 * w miejscu, w którym powstało. Ten odczyt istnieje po to, żeby sekcja „Zadania opieki" pokazywała
 * to, co sama zakłada.
 */
export async function getPlantCareTasks(plantId: string): Promise<ZadanieOpiekiDTO[]> {
  const user = await requireAuth();
  await assertPlantAccess(plantId, user.id);

  const zadania = await prisma.plantCareTask.findMany({
    take: SUFIT_LISTY,
    where: { plantId },
    select: { id: true, kind: true, title: true, nextDueAt: true, reason: true, active: true },
    orderBy: [{ active: "desc" }, { nextDueAt: "asc" }],
  });

  return zadania.map((z) => ({
    id: z.id,
    kind: z.kind as RodzajZabiegu,
    title: z.title,
    nextDueAt: z.nextDueAt?.toISOString() ?? null,
    reason: z.reason,
    active: z.active,
  }));
}

export async function updateCareTask(
  id: string,
  data: { title?: string; kind?: RodzajZabiegu; recurring?: string | null; active?: boolean },
): Promise<void> {
  const user = await requireAuth();
  const zadanie = await prisma.plantCareTask.findUnique({ where: { id }, select: { spaceId: true } });
  if (!zadanie) throw new Error("Zadanie opieki nie istnieje");
  await assertSpaceAccess(zadanie.spaceId, user.id, true);

  await prisma.plantCareTask.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.recurring !== undefined ? { recurring: data.recurring } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });

  revalidatePath("/rosliny/opieka");
  revalidatePath(`/rosliny/${zadanie.spaceId}`);
}

/**
 * Odnotowuje, co się stało z zaplanowanym zabiegiem, i wyznacza następny termin.
 *
 * `SKIPPED` i `POSTPONED` **nie są wariantami niepowodzenia** — są tym, co ratuje harmonogram przed
 * zamienieniem się w listę zaległości. Różnica między nimi jest w punkcie odniesienia: pominięcie
 * przesuwa cykl (liczymy od dziś, tak jakby zabieg się odbył), odłożenie przesuwa TERMIN o kilka dni
 * i zostawia cykl w spokoju.
 */
export async function recordCare(data: {
  taskId: string;
  outcome: WynikZabiegu;
  occurredAt?: Date;
  note?: string | null;
  odlozOIle?: number;
}): Promise<void> {
  const user = await requireAuth();
  const zadanie = await prisma.plantCareTask.findUnique({
    where: { id: data.taskId },
    select: { spaceId: true, plantId: true, placeId: true, kind: true, nextDueAt: true },
  });
  if (!zadanie) throw new Error("Zadanie opieki nie istnieje");
  await assertSpaceAccess(zadanie.spaceId, user.id, true);

  const kiedy = data.occurredAt ?? new Date();

  await prisma.plantCareEvent.create({
    data: {
      spaceId: zadanie.spaceId,
      plantId: zadanie.plantId,
      placeId: zadanie.placeId,
      taskId: data.taskId,
      kind: zadanie.kind,
      occurredAt: kiedy,
      outcome: data.outcome,
      note: data.note ?? null,
    },
  });

  if (data.outcome === "POSTPONED") {
    // Punkt odniesienia = PÓŹNIEJSZA z dat (termin, dziś). Liczenie zawsze od starego terminu
    // psuło odłożenie dokładnie tam, gdzie jest potrzebne: zadanie zaległe od miesiąca po
    // „odłóż o 2 dni" dostawało termin sprzed 26 dni — wciąż zaległe, wciąż na czele listy,
    // a UI zdejmowało pozycję z ekranu, więc wyglądało to na sukces aż do odświeżenia.
    const termin = zadanie.nextDueAt;
    const odKtorej = termin && termin.getTime() > kiedy.getTime() ? termin : kiedy;
    const oIle = data.odlozOIle && data.odlozOIle > 0 ? data.odlozOIle : 2;
    await prisma.plantCareTask.update({
      where: { id: data.taskId },
      data: {
        nextDueAt: new Date(odKtorej.getTime() + oIle * MS_DZIEN),
        reason: `odłożone o ${oIle} dni na Twoją prośbę`,
      },
    });
  } else {
    const wynik = await przeliczTermin(data.taskId, kiedy);
    await prisma.plantCareTask.update({
      where: { id: data.taskId },
      data: {
        // Pominięcie NIE jest wykonaniem, więc `lastDoneAt` zostaje nietknięte — inaczej historia
        // mówiłaby, że roślina była podlana, a nie była.
        ...(data.outcome === "DONE" ? { lastDoneAt: kiedy } : {}),
        // Ten sam warunek co przy zakładaniu zadania — i dlatego w jednej funkcji. Bez niego
        // odhaczenie podlewania gatunku bez cyklu dorabiało z powrotem techniczną datę, którą
        // zakładanie zadania właśnie usunęło.
        ...terminDoZapisu(wynik),
      },
    });
  }

  revalidatePath("/rosliny/opieka");
  revalidatePath(`/rosliny/${zadanie.spaceId}`);
  revalidatePath("/");
}

export interface ZdarzenieDTO {
  id: string;
  kind: RodzajZabiegu;
  outcome: WynikZabiegu;
  occurredAt: string;
  note: string | null;
  plantName: string | null;
  productName: string | null;
}

export async function getCareHistory(opts: { spaceId?: string; plantId?: string; limit?: number }): Promise<ZdarzenieDTO[]> {
  const user = await requireAuth();
  if (opts.plantId) await assertPlantAccess(opts.plantId, user.id);
  else if (opts.spaceId) await assertSpaceAccess(opts.spaceId, user.id);

  const zdarzenia = await prisma.plantCareEvent.findMany({
    take: Math.min(opts.limit ?? 100, SUFIT_LISTY),
    where: {
      ...(opts.plantId ? { plantId: opts.plantId } : {}),
      ...(opts.spaceId ? { spaceId: opts.spaceId } : {}),
      space: { is: await zakresPrzestrzeni(user.id) },
    },
    select: {
      id: true,
      kind: true,
      outcome: true,
      occurredAt: true,
      note: true,
      productName: true,
      plant: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  return zdarzenia.map((z) => ({
    id: z.id,
    kind: z.kind as RodzajZabiegu,
    outcome: z.outcome as WynikZabiegu,
    occurredAt: z.occurredAt.toISOString(),
    note: z.note,
    plantName: z.plant?.name ?? null,
    productName: z.productName,
  }));
}
