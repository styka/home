"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { assertSpaceAccess } from "./przestrzenie";
import { historiaMiejsca, ostrzezeniePlodozmianu, type WpisHistorii } from "../domain/plodozmian";
import type { Naslonecznienie, RodzajMiejsca } from "../lib/typy";

/**
 * 113 — MIEJSCA W PRZESTRZENI.
 *
 * Jedno pojęcie w czterech skalach: parapet, grządka, sektor, pole. To miejsce, a nie roślina,
 * niesie warunki (nasłonecznienie, gleba, powierzchnia) — ta sama monstera na parapecie południowym
 * i w głębi pokoju potrzebuje innego odstępu podlewania, i właśnie dlatego miejsce jest osobnym
 * bytem, a nie polem tekstowym przy roślinie.
 *
 * Miejsce niesie też **historię** („co tu rosło"), z której liczy się płodozmian (AC-26). Bez niej
 * ostrzeżenie płodozmianowe byłoby niewykonalne w ogóle — patrz `badania.md`, poziom 5.
 */

export interface MiejsceDTO {
  id: string;
  spaceId: string;
  name: string;
  kind: RodzajMiejsca;
  sun: Naslonecznienie;
  soil: string | null;
  areaValue: number | null;
  areaUnit: string | null;
  notes: string | null;
  liczbaRoslin: number;
}

export async function getPlaces(spaceId: string): Promise<MiejsceDTO[]> {
  const user = await requireAuth();
  await assertSpaceAccess(spaceId, user.id);

  const places = await prisma.plantPlace.findMany({
    take: SUFIT_LISTY,
    where: { spaceId },
    orderBy: [{ name: "asc" }],
  });

  const aktywne = await prisma.plant.groupBy({
    by: ["placeId"],
    where: { spaceId, status: "ACTIVE", placeId: { not: null } },
    _count: { _all: true },
  });
  const wgMiejsca = new Map(aktywne.map((a) => [a.placeId, a._count._all]));

  return places.map((p) => ({
    id: p.id,
    spaceId: p.spaceId,
    name: p.name,
    kind: p.kind as RodzajMiejsca,
    sun: p.sun as Naslonecznienie,
    soil: p.soil,
    areaValue: p.areaValue,
    areaUnit: p.areaUnit,
    notes: p.notes,
    liczbaRoslin: wgMiejsca.get(p.id) ?? 0,
  }));
}

export async function createPlace(data: {
  spaceId: string;
  name: string;
  kind?: RodzajMiejsca;
  sun?: Naslonecznienie;
  soil?: string | null;
  areaValue?: number | null;
  areaUnit?: string | null;
  notes?: string | null;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertSpaceAccess(data.spaceId, user.id, true);

  const nazwa = data.name?.trim();
  if (!nazwa) throw new Error("Nazwa miejsca jest wymagana");

  const place = await prisma.plantPlace.create({
    data: {
      spaceId: data.spaceId,
      name: nazwa,
      kind: data.kind ?? "windowsill",
      sun: data.sun ?? "unknown",
      soil: data.soil ?? null,
      areaValue: data.areaValue ?? null,
      areaUnit: data.areaUnit ?? null,
      notes: data.notes ?? null,
    },
    select: { id: true },
  });

  revalidatePath(`/rosliny/${data.spaceId}`);
  return place;
}

export async function updatePlace(
  id: string,
  data: {
    name?: string;
    kind?: RodzajMiejsca;
    sun?: Naslonecznienie;
    soil?: string | null;
    areaValue?: number | null;
    areaUnit?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const user = await requireAuth();
  const place = await prisma.plantPlace.findUnique({ where: { id }, select: { spaceId: true } });
  if (!place) throw new Error("Miejsce nie istnieje");
  await assertSpaceAccess(place.spaceId, user.id, true);

  await prisma.plantPlace.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.sun !== undefined ? { sun: data.sun } : {}),
      ...(data.soil !== undefined ? { soil: data.soil } : {}),
      ...(data.areaValue !== undefined ? { areaValue: data.areaValue } : {}),
      ...(data.areaUnit !== undefined ? { areaUnit: data.areaUnit } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });

  revalidatePath(`/rosliny/${place.spaceId}`);
}

/**
 * Usuwa miejsce. **Bez kosza i to jest świadome**: rośliny NIE giną razem z nim (`placeId` idzie
 * na `SET NULL`), więc nie ma tu utraty pracy, którą kosz miałby ratować. Zostaje pusta etykieta,
 * którą użytkownik odtworzy jednym polem.
 */
export async function deletePlace(id: string): Promise<void> {
  const user = await requireAuth();
  const place = await prisma.plantPlace.findUnique({ where: { id }, select: { spaceId: true } });
  if (!place) throw new Error("Miejsce nie istnieje");
  await assertSpaceAccess(place.spaceId, user.id, true);

  await prisma.plantPlace.delete({ where: { id } });
  revalidatePath(`/rosliny/${place.spaceId}`);
}

export interface HistoriaMiejscaDTO {
  wpisy: { rok: number; nazwa: string; rodzina: string | null; status: string }[];
  ostrzezenie: { poziom: "info" | "warn"; tresc: string; powtorzenia: number } | null;
}

/**
 * Co rosło w tym miejscu i czy planowana rodzina botaniczna wymaga ostrzeżenia.
 *
 * Sezon liczymy z **daty siewu albo nabycia**, a gdy ich nie ma — z daty utworzenia rekordu.
 * To jest przybliżenie i wolno je tak zrobić: płodozmian operuje sezonami, a nie dniami, więc
 * pomyłka o tydzień nic nie zmienia. Pomyłka o rok zmieniłaby wszystko, dlatego bierzemy najwcześniejszą
 * znaną datę, a nie datę ostatniej edycji.
 */
export async function getPlaceHistory(
  placeId: string,
  rodzinaPlanowana?: string | null,
): Promise<HistoriaMiejscaDTO> {
  const user = await requireAuth();
  const place = await prisma.plantPlace.findUnique({ where: { id: placeId }, select: { spaceId: true } });
  if (!place) throw new Error("Miejsce nie istnieje");
  await assertSpaceAccess(place.spaceId, user.id);

  const rosliny = await prisma.plant.findMany({
    take: SUFIT_LISTY,
    where: { placeId },
    select: {
      name: true,
      status: true,
      sownAt: true,
      acquiredAt: true,
      createdAt: true,
      customSpecies: true,
      species: { select: { family: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const wpisy: (WpisHistorii & { status: string })[] = rosliny.map((r) => ({
    rok: (r.sownAt ?? r.acquiredAt ?? r.createdAt).getFullYear(),
    rodzina: r.species?.family ?? null,
    nazwa: r.name,
    status: r.status,
  }));

  const rokPlanowany = new Date().getFullYear();
  const ostrzezenie = ostrzezeniePlodozmianu(rodzinaPlanowana, wpisy, rokPlanowany);

  return {
    wpisy: historiaMiejsca(wpisy).map((w) => ({
      rok: w.rok,
      nazwa: w.nazwa ?? "",
      rodzina: w.rodzina,
      status: (w as WpisHistorii & { status?: string }).status ?? "ACTIVE",
    })),
    ostrzezenie,
  };
}
