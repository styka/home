"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { recordTrash } from "@/platform/trash/trash";
import { requireRoslinyAccess, sprawdzWskazania, zakresPrzestrzeni } from "../lib/sharingGuard";
import { assertSpaceAccess } from "./przestrzenie";
import { bladZmianyStanu, roslinaNaDTO, statusZakonczony, type RoslinaDTO } from "../domain/roslina";
import { zalozHarmonogramPodlewania } from "../lib/terminy";
import type { JednostkaLicznosci, StatusRosliny } from "../lib/typy";

/**
 * 113 — BYT ROŚLINNY.
 *
 * **Jedna tabela dla egzemplarza, partii i powierzchni.** `quantity` + `quantityUnit` to cała
 * różnica między „moją monsterą", „partią 001: 100 szt." i „pszenicą na 4,2 ha". Trzy osobne byty
 * byłyby naturalną pokusą i rozbiłyby ewidencję zabiegów, agendę opieki i oś czasu na trzy źródła,
 * które trzeba by scalać w kodzie (`badania.md`, poziom 1).
 *
 * **Śmierć rośliny jest daną, nie brakiem danej.** `status: "DEAD"` razem z `statusReason` to
 * najcenniejsza informacja zwrotna, jaką moduł zbiera — po roku pozwala powiedzieć „trzy razy
 * przelałeś sukulenty". Dlatego zakończenie NIE kasuje rekordu: byt znika z listy aktywnych,
 * ale zostaje w historii miejsca i w statystykach.
 */

const SELECT_ROSLINY = {
  id: true,
  spaceId: true,
  placeId: true,
  speciesId: true,
  name: true,
  customSpecies: true,
  quantity: true,
  quantityUnit: true,
  stage: true,
  status: true,
  statusReason: true,
  sownAt: true,
  acquiredAt: true,
  parentId: true,
  photoUrl: true,
  notes: true,
  place: { select: { name: true } },
  species: { select: { namePl: true, family: true } },
} as const;

/**
 * Rzuca, jeśli użytkownik nie ma dostępu do rośliny.
 * Dziedziczenie po przestrzeni robi platforma na podstawie `parent` w deklaracji — moduł go tu
 * nie powtarza (C-17).
 */
export async function assertPlantAccess(plantId: string, userId: string, needEdit = false): Promise<void> {
  const istnieje = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true } });
  if (!istnieje) throw new Error("Roślina nie istnieje");
  try {
    await requireRoslinyAccess(userId, { type: "rosliny.plant", id: plantId }, needEdit ? "plant.edit" : "plant.read");
  } catch {
    throw new Error(needEdit ? "Masz dostęp tylko do odczytu" : "Brak dostępu do rośliny");
  }
}

export async function getPlants(opts?: {
  spaceId?: string;
  placeId?: string;
  includeInactive?: boolean;
}): Promise<RoslinaDTO[]> {
  const user = await requireAuth();

  const rosliny = await prisma.plant.findMany({
    take: SUFIT_LISTY,
    where: {
      // Zakres idzie przez PRZESTRZEŃ, nie przez własność rośliny: przestrzeń udostępniona niesie
      // ze sobą swoje rośliny (dziedziczenie z deklaracji zasobu), a pytanie o własność rośliny
      // pokazywałoby obdarowanej osobie pustą przestrzeń.
      space: { is: await zakresPrzestrzeni(user.id) },
      ...(opts?.spaceId ? { spaceId: opts.spaceId } : {}),
      ...(opts?.placeId ? { placeId: opts.placeId } : {}),
      ...(opts?.includeInactive ? {} : { status: "ACTIVE" }),
    },
    select: SELECT_ROSLINY,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return rosliny.map(roslinaNaDTO);
}

export type { RoslinaDTO };

export interface RoslinaSzczegolDTO extends RoslinaDTO {
  rodzic: { id: string; name: string } | null;
  potomstwo: { id: string; name: string; status: StatusRosliny }[];
}

export async function getPlant(id: string): Promise<RoslinaSzczegolDTO | null> {
  const user = await requireAuth();
  await assertPlantAccess(id, user.id);

  const r = await prisma.plant.findUnique({
    where: { id },
    select: {
      ...SELECT_ROSLINY,
      parent: { select: { id: true, name: true } },
      // paginacja: kompletny — potomstwo jednej rośliny to rodowód, nie lista do przewijania;
      // ucięcie zgubiłoby sadzonkę bez śladu.
      offspring: { select: { id: true, name: true, status: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) return null;

  return {
    ...roslinaNaDTO(r),
    rodzic: r.parent,
    potomstwo: r.offspring.map((o) => ({ id: o.id, name: o.name, status: o.status as StatusRosliny })),
  };
}

export async function createPlant(data: {
  spaceId: string;
  name: string;
  placeId?: string | null;
  speciesId?: string | null;
  customSpecies?: string | null;
  quantity?: number;
  quantityUnit?: JednostkaLicznosci;
  stage?: string | null;
  sownAt?: Date | null;
  acquiredAt?: Date | null;
  parentId?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertSpaceAccess(data.spaceId, user.id, true);

  const nazwa = data.name?.trim();
  if (!nazwa) throw new Error("Nazwa rośliny jest wymagana");

  // Wskazania podane przez klienta muszą należeć do jego zakresu — klucz obcy sprawdza istnienie
  // wiersza, nie właściciela.
  await sprawdzWskazania(user.id, {
    spaceId: data.spaceId,
    placeId: data.placeId,
    speciesId: data.speciesId,
    plantId: data.parentId,
  });

  const przestrzen = await prisma.plantSpace.findUnique({
    where: { id: data.spaceId },
    select: { workspaceId: true },
  });
  if (!przestrzen) throw new Error("Przestrzeń nie istnieje");

  // Liczność nigdy nie schodzi do zera ani poniżej: „zero sztuk" nie jest bytem, tylko usunięciem
  // wyrażonym po cichu inną drogą.
  const ilosc = data.quantity !== undefined && data.quantity > 0 ? data.quantity : 1;

  const roslina = await prisma.plant.create({
    data: {
      // **Własność bierze się z PRZESTRZENI, nie z parametru wołającego.** Roślina nie ma
      // własnego właściciela — ma przestrzeń, w której rośnie, i to ona rozstrzyga, czyja jest.
      // Wersja z `teamId` (którego widok nigdy nie podawał) zapisywała roślinę w przestrzeni
      // OSOBISTEJ dodającego, choć `spaceId` wskazywał przestrzeń zespołu: po usunięciu jego konta
      // kaskada `Plant.workspace` zabierała zespołowi całą uprawę, bez wpisu w koszu. Rozjazd był
      // niewidoczny, bo zakres list idzie od T-58 przez przestrzeń, a nie przez własność rośliny.
      // `propagatePlant` robił to poprawnie od początku (`rodzic.workspaceId`).
      workspaceId: przestrzen.workspaceId,
      spaceId: data.spaceId,
      placeId: data.placeId ?? null,
      speciesId: data.speciesId ?? null,
      customSpecies: data.customSpecies ?? null,
      name: nazwa,
      quantity: ilosc,
      quantityUnit: data.quantityUnit ?? "szt",
      stage: data.stage ?? null,
      sownAt: data.sownAt ?? null,
      acquiredAt: data.acquiredAt ?? null,
      parentId: data.parentId ?? null,
      photoUrl: data.photoUrl ?? null,
      notes: data.notes ?? null,
    },
    select: { id: true },
  });

  // AC-8: nowa roślina od razu dostaje harmonogram, a jego pierwszy termin liczy się TĄ SAMĄ regułą
  // co każdy następny — razem z uzasadnieniem. Roślina dodana bez harmonogramu wymagałaby od
  // użytkownika drugiego kroku, o którym nikt mu nie powie.
  await zalozHarmonogramPodlewania(roslina.id);

  revalidatePath("/rosliny");
  revalidatePath("/rosliny/opieka");
  revalidatePath(`/rosliny/${data.spaceId}`);
  return roslina;
}

export async function updatePlant(
  id: string,
  data: {
    name?: string;
    placeId?: string | null;
    speciesId?: string | null;
    customSpecies?: string | null;
    quantity?: number;
    quantityUnit?: JednostkaLicznosci;
    stage?: string | null;
    sownAt?: Date | null;
    acquiredAt?: Date | null;
    photoUrl?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const user = await requireAuth();
  await assertPlantAccess(id, user.id, true);
  // `spaceId` rośliny podajemy JAWNIE, bo bez niego `sprawdzWskazania` schodzi do gałęzi „dowolna
  // moja przestrzeń": edytor przestrzeni nadanej mógł przypiąć własną roślinę do miejsca
  // właściciela i zanieczyścić mu płodozmian.
  const biezaca = await prisma.plant.findUnique({ where: { id }, select: { spaceId: true } });
  await sprawdzWskazania(user.id, {
    spaceId: biezaca?.spaceId,
    placeId: data.placeId,
    speciesId: data.speciesId,
  });

  const roslina = await prisma.plant.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.placeId !== undefined ? { placeId: data.placeId } : {}),
      ...(data.speciesId !== undefined ? { speciesId: data.speciesId } : {}),
      ...(data.customSpecies !== undefined ? { customSpecies: data.customSpecies } : {}),
      ...(data.quantity !== undefined && data.quantity > 0 ? { quantity: data.quantity } : {}),
      ...(data.quantityUnit !== undefined ? { quantityUnit: data.quantityUnit } : {}),
      ...(data.stage !== undefined ? { stage: data.stage } : {}),
      ...(data.sownAt !== undefined ? { sownAt: data.sownAt } : {}),
      ...(data.acquiredAt !== undefined ? { acquiredAt: data.acquiredAt } : {}),
      ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    select: { spaceId: true },
  });

  revalidatePath(`/rosliny/${roslina.spaceId}`);
  revalidatePath(`/rosliny/${roslina.spaceId}/roslina/${id}`);
}

/**
 * Zmienia stan cyklu życia rośliny.
 *
 * `statusReason` przy zakończeniu jest **wymagany dla `DEAD`** i to nie jest formalność: rejestr
 * porażek jest jedyną funkcją w całym module, która POPRAWIA użytkownika, zamiast tylko go
 * obsługiwać. Bez powodu zostaje sam fakt „padła", z którego nie da się niczego wywnioskować.
 */
export async function setPlantStatus(
  id: string,
  status: StatusRosliny,
  reason?: string | null,
): Promise<void> {
  const user = await requireAuth();
  await assertPlantAccess(id, user.id, true);

  const blad = bladZmianyStanu(status, reason);
  if (blad) throw new Error(blad);

  const roslina = await prisma.plant.update({
    where: { id },
    data: {
      status,
      statusReason: reason?.trim() || null,
      statusAt: statusZakonczony(status) ? new Date() : null,
    },
    select: { spaceId: true },
  });

  revalidatePath("/rosliny");
  revalidatePath(`/rosliny/${roslina.spaceId}`);
  revalidatePath(`/rosliny/${roslina.spaceId}/roslina/${id}`);
}

/**
 * Zakłada sadzonkę z istniejącej rośliny.
 *
 * Nowy byt wskazuje rodzica — i to jest fundament, na którym stanie genetyka z etapu 3. Pole
 * powstaje TERAZ, bo dokładanie relacji do zapełnionej tabeli jest migracją z wypełnianiem wstecz,
 * a założenie jej od razu nie kosztuje nic (`badania.md`, poziom 1 i 10).
 */
export async function propagatePlant(
  parentId: string,
  data?: { name?: string; placeId?: string | null; quantity?: number },
): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertPlantAccess(parentId, user.id, true);

  const rodzic = await prisma.plant.findUnique({
    where: { id: parentId },
    select: {
      spaceId: true,
      placeId: true,
      speciesId: true,
      customSpecies: true,
      quantityUnit: true,
      name: true,
      workspaceId: true,
    },
  });
  if (!rodzic) throw new Error("Roślina nie istnieje");
  // `placeId` przychodzi z klienta i szło dotąd prosto do zapisu — guard sprawdzał wyłącznie
  // RODZICA. Sadzonka z cudzym miejscem zanieczyszczała ofierze historię miejsca i jej ostrzeżenie
  // płodozmianowe, bo `getPlaceHistory` pyta po samym `placeId`.
  if (data?.placeId !== undefined) {
    await sprawdzWskazania(user.id, { spaceId: rodzic.spaceId, placeId: data.placeId });
  }

  const sadzonka = await prisma.plant.create({
    data: {
      workspaceId: rodzic.workspaceId,
      spaceId: rodzic.spaceId,
      placeId: data?.placeId !== undefined ? data.placeId : rodzic.placeId,
      speciesId: rodzic.speciesId,
      customSpecies: rodzic.customSpecies,
      name: data?.name?.trim() || `${rodzic.name} — sadzonka`,
      quantity: data?.quantity && data.quantity > 0 ? data.quantity : 1,
      quantityUnit: rodzic.quantityUnit,
      parentId,
      sownAt: new Date(),
    },
    select: { id: true },
  });

  await zalozHarmonogramPodlewania(sadzonka.id);

  revalidatePath(`/rosliny/${rodzic.spaceId}`);
  revalidatePath(`/rosliny/${rodzic.spaceId}/roslina/${parentId}`);
  return sadzonka;
}

/**
 * Usuwa roślinę — do kosza (C-24).
 *
 * Uwaga na różnicę wobec zakończenia: **usunięcie to „nigdy tego nie było"**, zakończenie to
 * „to się skończyło". Zdarzenia opieki przeżywają usunięcie (`plantId` idzie na `SET NULL`), bo są
 * historią MIEJSCA, a w trybie zawodowym — ewidencją, której prawo każe nie kasować.
 */
export async function deletePlant(id: string): Promise<void> {
  const user = await requireAuth();
  await assertPlantAccess(id, user.id, true);

  const roslina = await prisma.plant.findUnique({
    where: { id },
    include: {
      // paginacja: kompletny — migawka musi zawierać wszystko, co kaskada usunie. Dziennik jest tu
      // treścią, nie metadanymi: to seria zdjęć w czasie, czyli rzecz, dla której użytkownik wraca
      // do modułu. Wpis kosza kasuje się po przywróceniu, więc czego tu nie ma, tego nie będzie.
      journal: true,
      measurements: true,
      healthEvents: true,
    },
  });
  if (!roslina) throw new Error("Roślina nie istnieje");

  await recordTrash(user.id, {
    module: "rosliny",
    entityId: roslina.id,
    title: `Roślina: ${roslina.name}`,
    payload: { rodzaj: "plant", plant: roslina },
  });

  await prisma.plant.delete({ where: { id } });

  revalidatePath("/rosliny");
  revalidatePath(`/rosliny/${roslina.spaceId}`);
  revalidatePath("/trash");
}
