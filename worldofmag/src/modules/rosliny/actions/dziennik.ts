"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { assertPlantAccess } from "./rosliny";
import type { RodzajPomiaru } from "../lib/typy";

/**
 * 113 — DZIENNIK I POMIARY.
 *
 * **Zdjęcie tego samego ujęcia co tydzień jest jedyną rzeczą, dzięki której użytkownik WIDZI,
 * że jego opieka działa.** Wstępna mapa właściciela wymieniała to jako „progress shots"; badanie
 * podniosło to do rangi funkcji pierwszej klasy, bo to najsilniejszy mechanizm utrzymania
 * użytkownika przy module (`badania.md`, poziom 3).
 *
 * **Pomiar ma RODZAJ i JEDNOSTKĘ, a nie kolumnę na każdą wielkość.** Wysokość, liczba liści,
 * wilgotność podłoża i plon to jeden byt — inaczej dodanie piątej wielkości byłoby migracją.
 * `source` odróżnia wpis ręczny od sensora i istnieje od pierwszego dnia właśnie po to, żeby
 * etap 2 (IoT) był dopisaniem wierszy, a nie zmianą schematu.
 */

export interface WpisDziennikaDTO {
  id: string;
  occurredAt: string;
  text: string | null;
  photoUrl: string | null;
}

export async function getJournal(plantId: string, limit = 100): Promise<WpisDziennikaDTO[]> {
  const user = await requireAuth();
  await assertPlantAccess(plantId, user.id);

  const wpisy = await prisma.plantJournalEntry.findMany({
    take: Math.min(limit, SUFIT_LISTY),
    where: { plantId },
    orderBy: { occurredAt: "desc" },
  });

  return wpisy.map((w) => ({
    id: w.id,
    occurredAt: w.occurredAt.toISOString(),
    text: w.text,
    photoUrl: w.photoUrl,
  }));
}

export async function addJournalEntry(data: {
  plantId: string;
  text?: string | null;
  photoUrl?: string | null;
  occurredAt?: Date;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertPlantAccess(data.plantId, user.id, true);

  // Wpis bez treści i bez zdjęcia byłby pustym wierszem na osi czasu — nie ma czego pokazać.
  if (!data.text?.trim() && !data.photoUrl) {
    throw new Error("Dodaj treść albo zdjęcie");
  }

  const wpis = await prisma.plantJournalEntry.create({
    data: {
      plantId: data.plantId,
      text: data.text?.trim() || null,
      photoUrl: data.photoUrl ?? null,
      occurredAt: data.occurredAt ?? new Date(),
    },
    select: { id: true, plant: { select: { spaceId: true } } },
  });

  revalidatePath(`/rosliny/${wpis.plant.spaceId}/roslina/${data.plantId}`);
  return { id: wpis.id };
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const user = await requireAuth();
  const wpis = await prisma.plantJournalEntry.findUnique({
    where: { id },
    select: { plantId: true, plant: { select: { spaceId: true } } },
  });
  if (!wpis) throw new Error("Wpis nie istnieje");
  await assertPlantAccess(wpis.plantId, user.id, true);

  await prisma.plantJournalEntry.delete({ where: { id } });
  revalidatePath(`/rosliny/${wpis.plant.spaceId}/roslina/${wpis.plantId}`);
}

export interface PomiarDTO {
  id: string;
  measuredAt: string;
  kind: RodzajPomiaru;
  value: number;
  unit: string;
  source: string;
  note: string | null;
}

/** Domyślna jednostka dla rodzaju pomiaru — żeby użytkownik nie wpisywał „cm" przy każdej wysokości. */
const JEDNOSTKI: Record<RodzajPomiaru, string> = {
  HEIGHT_CM: "cm",
  LEAF_COUNT: "szt",
  TRUNK_CM: "cm",
  SOIL_MOISTURE: "%",
  TEMP_C: "°C",
  PH: "pH",
  LIGHT: "lx",
  OTHER: "",
};

export async function getMeasurements(plantId: string, kind?: RodzajPomiaru): Promise<PomiarDTO[]> {
  const user = await requireAuth();
  await assertPlantAccess(plantId, user.id);

  const pomiary = await prisma.plantMeasurement.findMany({
    take: SUFIT_LISTY,
    where: { plantId, ...(kind ? { kind } : {}) },
    orderBy: { measuredAt: "asc" },
  });

  return pomiary.map((p) => ({
    id: p.id,
    measuredAt: p.measuredAt.toISOString(),
    kind: p.kind as RodzajPomiaru,
    value: p.value,
    unit: p.unit,
    source: p.source,
    note: p.note,
  }));
}

export async function addMeasurement(data: {
  plantId: string;
  kind: RodzajPomiaru;
  value: number;
  unit?: string;
  note?: string | null;
  measuredAt?: Date;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertPlantAccess(data.plantId, user.id, true);

  if (!Number.isFinite(data.value)) throw new Error("Wartość pomiaru musi być liczbą");

  const pomiar = await prisma.plantMeasurement.create({
    data: {
      plantId: data.plantId,
      kind: data.kind,
      value: data.value,
      unit: data.unit || JEDNOSTKI[data.kind] || "",
      // Wszystko, co wchodzi tą akcją, jest wpisem ręcznym. Sensor z etapu 2 dopisze się do tej
      // samej tabeli własną drogą i będzie się różnił wyłącznie tym polem.
      source: "manual",
      note: data.note ?? null,
      measuredAt: data.measuredAt ?? new Date(),
    },
    select: { id: true, plant: { select: { spaceId: true } } },
  });

  revalidatePath(`/rosliny/${pomiar.plant.spaceId}/roslina/${data.plantId}`);
  return { id: pomiar.id };
}
