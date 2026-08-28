"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth, ownedWhereAsync } from "@/platform/auth/serverUtils";
import { assertSpaceAccess } from "./przestrzenie";
import { brakiEwidencji, ewidencjaDoCsv, type WierszEwidencji } from "../lib/eksportEwidencji";
import { TRYBY_ZAWODOWE } from "../lib/typy";

/**
 * 113 — EWIDENCJA ZABIEGÓW ŚRODKAMI OCHRONY ROŚLIN.
 *
 * **To jedyny element całego modułu z zewnętrznym, datowanym przymusem.** Od 1 stycznia 2026
 * profesjonalni użytkownicy środków ochrony roślin w Polsce prowadzą ewidencję zabiegów uzupełnioną
 * o trzy nowe pola — **rodzaj zastosowania, numer zezwolenia i dokładną lokalizację** — a zapisy
 * muszą zostać doprowadzone do formy elektronicznej do 31 stycznia roku następującego po roku
 * zastosowania. Kontrola weryfikuje **kompletność danych**, zgodność dawek i lokalizację.
 *
 * Zakres jest świadomie wąski: **rejestr i eksport, bez integracji z systemem rządowym**
 * (decyzja właściciela, spec §8). Integracja jest osobną, znacznie większą pracą i nie jest
 * warunkiem spełnienia obowiązku — obowiązek dotyczy prowadzenia i formy, a nie kanału przesyłania.
 *
 * **Braki nie blokują zapisu.** `brakiEwidencji` zwraca listę pól do uzupełnienia, a akcja przekazuje
 * ją wywołującemu. Zablokowanie zapisu ukarałoby kogoś, kto właśnie wrócił z pola i uzupełni numer
 * zezwolenia wieczorem — a skutkiem byłby zabieg **niezapisany w ogóle**, czyli dokładnie to, czemu
 * ewidencja ma zapobiegać.
 */

export interface ZapisEwidencjiWynik {
  id: string;
  /** Pola, których brakuje do kompletności wobec wymogu. Pusta lista = wpis kompletny. */
  braki: string[];
}

export async function recordTreatment(data: {
  spaceId: string;
  plantId?: string | null;
  placeId?: string | null;
  occurredAt?: Date;
  productName?: string | null;
  permitNumber?: string | null;
  applicationKind?: string | null;
  doseValue?: number | null;
  doseUnit?: string | null;
  areaValue?: number | null;
  areaUnit?: string | null;
  locationText?: string | null;
  operator?: string | null;
  conditions?: string | null;
  withdrawalDays?: number | null;
  note?: string | null;
}): Promise<ZapisEwidencjiWynik> {
  const user = await requireAuth();
  await assertSpaceAccess(data.spaceId, user.id, true);

  const zdarzenie = await prisma.plantCareEvent.create({
    data: {
      spaceId: data.spaceId,
      plantId: data.plantId ?? null,
      placeId: data.placeId ?? null,
      kind: "SPRAYING",
      occurredAt: data.occurredAt ?? new Date(),
      outcome: "DONE",
      productName: data.productName ?? null,
      permitNumber: data.permitNumber ?? null,
      applicationKind: data.applicationKind ?? null,
      doseValue: data.doseValue ?? null,
      doseUnit: data.doseUnit ?? null,
      areaValue: data.areaValue ?? null,
      areaUnit: data.areaUnit ?? null,
      locationText: data.locationText ?? null,
      operator: data.operator ?? null,
      conditions: data.conditions ?? null,
      // Karencja jest zapisywana od pierwszego dnia, choć ostrzeżenie „nie zbieraj przed" jest
      // etapem 2 — inaczej etap 2 zaczynałby się od migracji na zapełnionej tabeli (spec §5).
      withdrawalDays: data.withdrawalDays ?? null,
      note: data.note ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/rosliny/ewidencja");
  revalidatePath(`/rosliny/${data.spaceId}`);

  return { id: zdarzenie.id, braki: brakiEwidencji(data as Partial<WierszEwidencji>) };
}

export interface PozycjaRejestruDTO {
  id: string;
  occurredAt: string;
  spaceName: string;
  plantName: string | null;
  placeName: string | null;
  productName: string | null;
  permitNumber: string | null;
  applicationKind: string | null;
  doseValue: number | null;
  doseUnit: string | null;
  areaValue: number | null;
  areaUnit: string | null;
  locationText: string | null;
  operator: string | null;
  conditions: string | null;
  withdrawalDays: number | null;
  note: string | null;
  /** Czego brakuje do kompletności — liczone przy odczycie, żeby braki było widać w rejestrze. */
  braki: string[];
}

/**
 * Rejestr zabiegów za okres.
 *
 * **Widzi wyłącznie przestrzenie w trybie zawodowym** (produkcja, pole). Nie jest to blokada
 * zapisu — zdarzenie z wypełnionymi polami zapisze się w każdej przestrzeni — tylko odpowiedź na
 * pytanie „co podlega ewidencji": parapet w mieszkaniu nie podlega, a wciągnięcie go do rejestru
 * zamieniłoby dokument w listę podlewań.
 */
export async function getTreatmentRegister(opts?: {
  spaceId?: string;
  od?: Date;
  do?: Date;
}): Promise<PozycjaRejestruDTO[]> {
  const user = await requireAuth();
  if (opts?.spaceId) await assertSpaceAccess(opts.spaceId, user.id);

  // paginacja: kompletny — to jest dokument, z którego liczy się kompletność wobec kontroli;
  // ucięta lista dałaby eksport po cichu niepełny, czyli gorszy niż jego brak.
  const zdarzenia = await prisma.plantCareEvent.findMany({
    where: {
      kind: "SPRAYING",
      ...(opts?.spaceId ? { spaceId: opts.spaceId } : {}),
      ...(opts?.od || opts?.do
        ? { occurredAt: { ...(opts.od ? { gte: opts.od } : {}), ...(opts.do ? { lte: opts.do } : {}) } }
        : {}),
      space: {
        is: { ...(await ownedWhereAsync(user.id)), kind: { in: TRYBY_ZAWODOWE } },
      },
    },
    select: {
      id: true,
      occurredAt: true,
      productName: true,
      permitNumber: true,
      applicationKind: true,
      doseValue: true,
      doseUnit: true,
      areaValue: true,
      areaUnit: true,
      locationText: true,
      operator: true,
      conditions: true,
      withdrawalDays: true,
      note: true,
      space: { select: { name: true } },
      plant: { select: { name: true } },
      place: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  return zdarzenia.map((z) => ({
    id: z.id,
    occurredAt: z.occurredAt.toISOString(),
    spaceName: z.space.name,
    plantName: z.plant?.name ?? null,
    placeName: z.place?.name ?? null,
    productName: z.productName,
    permitNumber: z.permitNumber,
    applicationKind: z.applicationKind,
    doseValue: z.doseValue,
    doseUnit: z.doseUnit,
    areaValue: z.areaValue,
    areaUnit: z.areaUnit,
    locationText: z.locationText,
    operator: z.operator,
    conditions: z.conditions,
    withdrawalDays: z.withdrawalDays,
    note: z.note,
    braki: brakiEwidencji({
      productName: z.productName,
      permitNumber: z.permitNumber,
      applicationKind: z.applicationKind,
      doseValue: z.doseValue,
      areaValue: z.areaValue,
      locationText: z.locationText,
      operator: z.operator,
    }),
  }));
}

export interface EksportEwidencji {
  nazwaPliku: string;
  csv: string;
  liczbaZabiegow: number;
  /** Ile wierszy jest niekompletnych — informacja dla użytkownika PRZED oddaniem dokumentu. */
  liczbaNiekompletnych: number;
}

export async function exportTreatmentRegister(opts?: {
  spaceId?: string;
  od?: Date;
  do?: Date;
}): Promise<EksportEwidencji> {
  const pozycje = await getTreatmentRegister(opts);

  const wiersze: WierszEwidencji[] = pozycje.map((p) => ({
    occurredAt: new Date(p.occurredAt),
    spaceName: p.spaceName,
    plantName: p.plantName,
    placeName: p.placeName,
    productName: p.productName,
    permitNumber: p.permitNumber,
    applicationKind: p.applicationKind,
    doseValue: p.doseValue,
    doseUnit: p.doseUnit,
    areaValue: p.areaValue,
    areaUnit: p.areaUnit,
    locationText: p.locationText,
    operator: p.operator,
    conditions: p.conditions,
    withdrawalDays: p.withdrawalDays,
    note: p.note,
  }));

  const rok = opts?.od ? opts.od.getFullYear() : new Date().getFullYear();

  return {
    nazwaPliku: `ewidencja-zabiegow-${rok}.csv`,
    csv: ewidencjaDoCsv(wiersze),
    liczbaZabiegow: wiersze.length,
    liczbaNiekompletnych: pozycje.filter((p) => p.braki.length > 0).length,
  };
}
