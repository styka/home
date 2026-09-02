"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { addPantryItem, deletePantryItem } from "@/modules/kitchen/contract";
import { resolveOrCreateList, addItemStructured } from "@/modules/shopping/contract";
import { bookAutoExpense } from "@/modules/portfel/contract";
import { zakresPrzestrzeni } from "../lib/sharingGuard";
import { assertPlantAccess } from "./rosliny";
import { assertSpaceAccess } from "./przestrzenie";

/**
 * 113 — ZBIORY I DROGA „Z GRZĄDKI NA TALERZ".
 *
 * **Ten plik jest granicą modułu wyrażoną w kodzie.** Zbiór trafia do spiżarni Kuchni, koszt do
 * Portfela, brakujące nasiona na listę Zakupów — i wszystko to idzie **przez kontrakty tych
 * modułów**, bez budowania u siebie ani spiżarni, ani księgowości, ani listy zakupów (spec §5).
 * To jest ta sama droga, którą Flota księguje paliwo, a Pogoda dopisuje pomysły do Zadań.
 *
 * **Dlaczego akurat spiżarnia jest tu najważniejsza.** Żadna samodzielna aplikacja ogrodnicza nie
 * może zapisać zbioru do spiżarni i podpowiedzieć przepisu, bo nie ma spiżarni. Omnia ma — i to
 * jest najmocniejsze pojedyncze uzasadnienie, żeby ten moduł powstał właśnie tutaj
 * (`badania.md`, poziom 9).
 *
 * Zbiór NIE jest osobną tabelą: to zdarzenie-zabieg rodzaju `HARVEST`. Dzięki temu widnieje na tej
 * samej osi czasu co podlanie i oprysk, a analityka plonu czyta jedno źródło.
 */

export interface ZbiorDTO {
  id: string;
  occurredAt: string;
  plantId: string | null;
  plantName: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  note: string | null;
  /** Czy pozycja została już wysłana do spiżarni — żeby nie wysłać jej drugi raz. */
  wSpizarni: boolean;
}

export async function getHarvests(opts: { spaceId?: string; plantId?: string; limit?: number }): Promise<ZbiorDTO[]> {
  const user = await requireAuth();
  if (opts.plantId) await assertPlantAccess(opts.plantId, user.id);
  else if (opts.spaceId) await assertSpaceAccess(opts.spaceId, user.id);

  const zbiory = await prisma.plantCareEvent.findMany({
    take: Math.min(opts.limit ?? 100, SUFIT_LISTY),
    where: {
      kind: "HARVEST",
      ...(opts.plantId ? { plantId: opts.plantId } : {}),
      ...(opts.spaceId ? { spaceId: opts.spaceId } : {}),
      space: { is: await zakresPrzestrzeni(user.id) },
    },
    select: {
      id: true,
      occurredAt: true,
      plantId: true,
      quantity: true,
      quantityUnit: true,
      note: true,
      pantryItemId: true,
      plant: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  return zbiory.map((z) => ({
    id: z.id,
    occurredAt: z.occurredAt.toISOString(),
    plantId: z.plantId,
    plantName: z.plant?.name ?? null,
    quantity: z.quantity,
    quantityUnit: z.quantityUnit,
    note: z.note,
    wSpizarni: Boolean(z.pantryItemId),
  }));
}

export async function recordHarvest(data: {
  plantId: string;
  quantity: number;
  quantityUnit?: string;
  occurredAt?: Date;
  note?: string | null;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertPlantAccess(data.plantId, user.id, true);

  if (!(data.quantity > 0)) throw new Error("Podaj zebraną ilość");

  const roslina = await prisma.plant.findUnique({
    where: { id: data.plantId },
    select: { spaceId: true, placeId: true },
  });
  if (!roslina) throw new Error("Roślina nie istnieje");

  const zdarzenie = await prisma.plantCareEvent.create({
    data: {
      spaceId: roslina.spaceId,
      plantId: data.plantId,
      placeId: roslina.placeId,
      kind: "HARVEST",
      occurredAt: data.occurredAt ?? new Date(),
      outcome: "DONE",
      quantity: data.quantity,
      quantityUnit: data.quantityUnit || "kg",
      note: data.note ?? null,
    },
    select: { id: true },
  });

  revalidatePath(`/rosliny/${roslina.spaceId}`);
  revalidatePath(`/rosliny/${roslina.spaceId}/roslina/${data.plantId}`);
  return zdarzenie;
}

/**
 * Wysyła zebrany plon do spiżarni Kuchni.
 *
 * Idempotentnie po `pantryItemId`: drugie kliknięcie nie tworzy drugiej pozycji. Bez tego
 * przypadkowy dublet trzeba by odkręcać w innym module niż ten, w którym powstał.
 *
 * **Sam odczyt `pantryItemId` na to nie wystarcza** — sprawdzenie i zapis to dwa kroki, a między
 * nimi mieści się drugie kliknięcie (podwójny tap na telefonie, dwie otwarte karty). Oba przeszłyby
 * warunek i oba założyłyby pozycję w spiżarni. Zajęcie zbioru robimy więc **warunkowym UPDATE**
 * (`updateMany` z `pantryItemId: null`), czyli operacją, którą baza rozstrzyga atomowo: przegrany
 * wątek dostaje `count === 0`, **sprząta swoją nadmiarową pozycję** i zwraca tę, która wygrała.
 * Bez tego sprzątania idempotencja byłaby pozorna — dublet zostałby w Kuchni, tylko bez wskaźnika.
 */
export async function harvestToPantry(
  eventId: string,
  opts?: { name?: string; expiresAt?: Date | null },
): Promise<{ pantryItemId: string }> {
  const user = await requireAuth();

  const zdarzenie = await prisma.plantCareEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      spaceId: true,
      kind: true,
      quantity: true,
      quantityUnit: true,
      pantryItemId: true,
      plant: { select: { id: true, name: true, species: { select: { namePl: true } } } },
    },
  });
  if (!zdarzenie) throw new Error("Zbiór nie istnieje");
  // Do spiżarni idzie wyłącznie ZBIÓR — Server Action jest wywoływalna z dowolnym id, więc bez
  // tego warunku dowolne zdarzenie z mojego zakresu (np. wpis ewidencji oprysku) dało się wysłać
  // do Kuchni jako „1 kg <nazwa rośliny>".
  if (zdarzenie.kind !== "HARVEST") throw new Error("To zdarzenie nie jest zbiorem");
  await assertSpaceAccess(zdarzenie.spaceId, user.id, true);
  if (zdarzenie.pantryItemId) return { pantryItemId: zdarzenie.pantryItemId };

  const nazwa = opts?.name?.trim() || zdarzenie.plant?.species?.namePl || zdarzenie.plant?.name || "Zbiór";

  const pozycja = await addPantryItem({
    name: nazwa,
    quantity: zdarzenie.quantity ?? 1,
    unit: zdarzenie.quantityUnit ?? "kg",
    expiresAt: opts?.expiresAt ?? null,
  });

  const zajete = await prisma.plantCareEvent.updateMany({
    where: { id: eventId, pantryItemId: null },
    data: { pantryItemId: pozycja.id },
  });

  if (zajete.count === 0) {
    // Ktoś zdążył pierwszy. Nasza pozycja jest zbędna — kasujemy ją i zwracamy tę zapisaną,
    // żeby wywołujący dostał identyfikator, który naprawdę wisi przy tym zbiorze.
    await deletePantryItem(pozycja.id).catch(() => {});
    const aktualne = await prisma.plantCareEvent.findUnique({
      where: { id: eventId },
      select: { pantryItemId: true },
    });
    // Obie strony, tak samo jak w gałęzi wygranej: bez odświeżenia widoku roślin znacznik
    // „już w spiżarni" zostawał nieaktualny akurat u tego, kto kliknął drugi.
    revalidatePath(`/rosliny/${zdarzenie.spaceId}`);
    revalidatePath("/kitchen/pantry");
    if (!aktualne?.pantryItemId) throw new Error("Nie udało się zapisać zbioru w spiżarni");
    return { pantryItemId: aktualne.pantryItemId };
  }

  revalidatePath(`/rosliny/${zdarzenie.spaceId}`);
  revalidatePath("/kitchen/pantry");
  return { pantryItemId: pozycja.id };
}

/**
 * Księguje koszt zabiegu w Portfelu.
 *
 * `force: true`, bo to jest **jawna akcja użytkownika** („zapisz koszt"), a nie automat w tle —
 * globalny przełącznik auto-księgowania dotyczy tego drugiego. Idempotencję po
 * `(sourceModule, sourceId)` zapewnia sam Portfel, więc powtórne kliknięcie skoryguje kwotę zamiast
 * dopisać drugi wydatek.
 */
export async function bookCareCost(data: {
  eventId: string;
  amount: number;
  category?: string;
  note?: string | null;
}): Promise<void> {
  const user = await requireAuth();

  const zdarzenie = await prisma.plantCareEvent.findUnique({
    where: { id: data.eventId },
    select: { id: true, spaceId: true, occurredAt: true, kind: true, productName: true },
  });
  if (!zdarzenie) throw new Error("Zdarzenie nie istnieje");
  await assertSpaceAccess(zdarzenie.spaceId, user.id, true);

  await bookAutoExpense(user.id, {
    module: "rosliny",
    sourceId: zdarzenie.id,
    amount: data.amount,
    category: data.category ?? "Ogród",
    note: data.note ?? zdarzenie.productName ?? "Zabieg w module Rośliny",
    date: zdarzenie.occurredAt,
    force: true,
  });

  revalidatePath(`/rosliny/${zdarzenie.spaceId}`);
  revalidatePath("/portfel");
}

/**
 * Dopisuje pozycję (nasiona, nawóz, narzędzie) na listę zakupów.
 *
 * Lista jest rozstrzygana przez Zakupy (`resolveOrCreateList`) — moduł nie zna ani nazw list, ani
 * reguły ich wyboru i nie ma ich znać.
 */
export async function addToShoppingList(data: {
  name: string;
  quantity?: number;
  unit?: string | null;
  listName?: string;
}): Promise<void> {
  const user = await requireAuth();
  const nazwa = data.name?.trim();
  if (!nazwa) throw new Error("Podaj nazwę pozycji");

  const lista = await resolveOrCreateList(user.id, { listName: data.listName });
  await addItemStructured(lista.id, nazwa, data.quantity ?? 1, data.unit ?? null);

  revalidatePath("/shopping");
}
