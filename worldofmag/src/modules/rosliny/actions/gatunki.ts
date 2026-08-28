"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth, ownedWhereAsync } from "@/platform/auth/serverUtils";
import { wlasnoscOsobistaDoZapisu } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY, rozmiarStrony } from "@/platform/pagination";
import type { KategoriaGatunku, PochodzenieGatunku } from "../lib/typy";

/**
 * 113 — KATALOG GATUNKÓW.
 *
 * **Dwie tabele, wzorcem Wiadomości (082).** `PlantSpeciesCatalog` jest systemowy: bez właściciela
 * i bez przestrzeni, zaseedowany migracją, widoczny dla każdego zalogowanego. `PlantSpecies` to
 * KOPIA w przestrzeni użytkownika. Dodanie gatunku do siebie kopiuje wiersz.
 *
 * Powód techniczny stoi w nagłówku migracji 0272 (nowa tabela nie może mieć nullowalnej
 * przestrzeni), ale korzyść jest produktowa i to ona jest ważniejsza: użytkownik może zmienić
 * parametry pielęgnacji **swojej** monstery, nie ruszając wiersza systemowego, a wyłączenie
 * martwego wpisu w katalogu nikomu nie kasuje historii.
 *
 * **`origin` odpowiada na „skąd to wiem".** Bez tego pola po pół roku nikt nie odróżni faktu
 * botanicznego od treści, którą zaproponował model i ktoś kliknął „zapisz" (AC-17) — dokładnie ta
 * sama lekcja, co `UserFact.origin`.
 */

export interface GatunekKatalogDTO {
  key: string;
  namePl: string;
  nameLatin: string;
  family: string | null;
  category: KategoriaGatunku;
  light: string | null;
  soil: string | null;
  tempMinC: number | null;
  notes: string | null;
  /** Czy użytkownik ma już kopię tego gatunku u siebie. */
  juzMam: boolean;
}

export async function searchCatalog(opts?: {
  fraza?: string;
  category?: KategoriaGatunku;
  limit?: number;
}): Promise<GatunekKatalogDTO[]> {
  const user = await requireAuth();
  const fraza = opts?.fraza?.trim();

  const wpisy = await prisma.plantSpeciesCatalog.findMany({
    take: rozmiarStrony(opts?.limit ?? 60),
    where: {
      active: true,
      ...(opts?.category ? { category: opts.category } : {}),
      ...(fraza
        ? {
            OR: [
              { namePl: { contains: fraza, mode: "insensitive" as const } },
              { nameLatin: { contains: fraza, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ namePl: "asc" }],
  });

  // Które z nich użytkownik już ma. Jedno zapytanie na całą stronę wyników — pytanie per wiersz
  // dałoby sześćdziesiąt zapytań na jedno otwarcie katalogu.
  const moje = await prisma.plantSpecies.findMany({
    take: SUFIT_LISTY,
    where: { ...(await ownedWhereAsync(user.id)), catalogKey: { in: wpisy.map((w) => w.key) } },
    select: { catalogKey: true },
  });
  const mam = new Set(moje.map((m) => m.catalogKey));

  return wpisy.map((w) => ({
    key: w.key,
    namePl: w.namePl,
    nameLatin: w.nameLatin,
    family: w.family,
    category: w.category as KategoriaGatunku,
    light: w.light,
    soil: w.soil,
    tempMinC: w.tempMinC,
    notes: w.notes,
    juzMam: mam.has(w.key),
  }));
}

export interface GatunekDTO {
  id: string;
  catalogKey: string | null;
  origin: PochodzenieGatunku;
  namePl: string;
  nameLatin: string;
  family: string | null;
  category: KategoriaGatunku;
  light: string | null;
  waterJson: string | null;
  soil: string | null;
  tempMinC: number | null;
  notes: string | null;
}

export async function getSpeciesList(): Promise<GatunekDTO[]> {
  const user = await requireAuth();
  const wpisy = await prisma.plantSpecies.findMany({
    take: SUFIT_LISTY,
    where: await ownedWhereAsync(user.id),
    orderBy: [{ namePl: "asc" }],
  });

  return wpisy.map((w) => ({
    id: w.id,
    catalogKey: w.catalogKey,
    origin: w.origin as PochodzenieGatunku,
    namePl: w.namePl,
    nameLatin: w.nameLatin,
    family: w.family,
    category: w.category as KategoriaGatunku,
    light: w.light,
    waterJson: w.waterJson,
    soil: w.soil,
    tempMinC: w.tempMinC,
    notes: w.notes,
  }));
}

/**
 * Kopiuje wpis z katalogu systemowego do przestrzeni użytkownika.
 *
 * Idempotentnie: ponowne wywołanie zwraca istniejącą kopię zamiast tworzyć drugą. Widok pokazuje
 * „już mam", ale dwie karty otwarte obok siebie potrafią kliknąć to samo dwa razy, a indeks
 * unikalny zamieniłby to w błąd, którego użytkownik nie zrozumie.
 */
export async function addSpeciesFromCatalog(key: string): Promise<{ id: string }> {
  const user = await requireAuth();
  const wlasnosc = await wlasnoscOsobistaDoZapisu(user.id);

  const zrodlo = await prisma.plantSpeciesCatalog.findUnique({ where: { key } });
  if (!zrodlo) throw new Error("Nie ma takiego gatunku w katalogu");

  // Tożsamość kopii to KLUCZ WPISU KATALOGU. Szukanie po nazwie łacińskiej zwracałoby cukinię przy
  // próbie dodania dyni — obie to `Cucurbita pepo`, ale dla użytkownika to dwie różne uprawy
  // o różnych wymaganiach (migracja 0274).
  const istniejacy = await prisma.plantSpecies.findUnique({
    where: { workspaceId_catalogKey: { workspaceId: wlasnosc.workspaceId, catalogKey: zrodlo.key } },
    select: { id: true },
  });
  if (istniejacy) return istniejacy;

  const kopia = await prisma.plantSpecies.create({
    data: {
      ...wlasnosc,
      catalogKey: zrodlo.key,
      origin: "system",
      namePl: zrodlo.namePl,
      nameLatin: zrodlo.nameLatin,
      family: zrodlo.family,
      category: zrodlo.category,
      light: zrodlo.light,
      waterJson: zrodlo.waterJson,
      soil: zrodlo.soil,
      tempMinC: zrodlo.tempMinC,
      notes: zrodlo.notes,
    },
    select: { id: true },
  });

  revalidatePath("/rosliny/katalog");
  return kopia;
}

export async function createSpecies(data: {
  namePl: string;
  nameLatin: string;
  family?: string | null;
  category?: KategoriaGatunku;
  light?: string | null;
  waterJson?: string | null;
  soil?: string | null;
  tempMinC?: number | null;
  notes?: string | null;
  /** `ai` dla wpisu zaproponowanego przez model; domyślnie wpis użytkownika. */
  origin?: PochodzenieGatunku;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  const wlasnosc = await wlasnoscOsobistaDoZapisu(user.id);

  const pl = data.namePl?.trim();
  const lat = data.nameLatin?.trim();
  if (!pl || !lat) throw new Error("Podaj nazwę polską i łacińską");

  // Duplikaty WPISÓW WŁASNYCH odsiewamy tutaj, bo indeks unikalny ich nie obejmuje: mają
  // `catalogKey IS NULL`, a NULL-e w indeksie unikalnym są w PostgreSQL różne. Szukamy wyłącznie
  // wśród wpisów własnych — wpis skopiowany z katalogu o tej samej nazwie łacińskiej to inna uprawa
  // i nie powinien blokować dodania własnego.
  const istniejacy = await prisma.plantSpecies.findFirst({
    where: { workspaceId: wlasnosc.workspaceId, catalogKey: null, nameLatin: lat },
    select: { id: true },
  });
  if (istniejacy) return istniejacy;

  const gatunek = await prisma.plantSpecies.create({
    data: {
      ...wlasnosc,
      // Wpis własny NIE dostaje `catalogKey`, nawet jeśli nazwa łacińska przypadkiem pokrywa się
      // z katalogiem: `catalogKey` znaczy „skopiowane stąd", a nie „podobne do".
      origin: data.origin ?? "user",
      namePl: pl,
      nameLatin: lat,
      family: data.family ?? null,
      category: data.category ?? "other",
      light: data.light ?? null,
      waterJson: data.waterJson ?? null,
      soil: data.soil ?? null,
      tempMinC: data.tempMinC ?? null,
      notes: data.notes ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/rosliny/katalog");
  return gatunek;
}

/**
 * Edytuje KOPIĘ gatunku w przestrzeni użytkownika.
 *
 * Wiersz katalogu systemowego pozostaje nietknięty — to jest cała korzyść z rozdzielenia na dwie
 * tabele i jednocześnie rzecz, którą najłatwiej zepsuć, sięgając „przy okazji" do katalogu.
 * Zmiana kopii pochodzącej z katalogu **nie zmienia `origin`**: pochodzenie mówi, skąd wiersz się
 * WZIĄŁ, a nie kto go ostatnio dotknął.
 */
export async function updateSpecies(
  id: string,
  data: {
    namePl?: string;
    family?: string | null;
    category?: KategoriaGatunku;
    light?: string | null;
    waterJson?: string | null;
    soil?: string | null;
    tempMinC?: number | null;
    notes?: string | null;
  },
): Promise<void> {
  const user = await requireAuth();
  const gatunek = await prisma.plantSpecies.findFirst({
    where: { id, ...(await ownedWhereAsync(user.id)) },
    select: { id: true },
  });
  if (!gatunek) throw new Error("Nie masz dostępu do tego gatunku");

  await prisma.plantSpecies.update({
    where: { id },
    data: {
      ...(data.namePl !== undefined ? { namePl: data.namePl.trim() } : {}),
      ...(data.family !== undefined ? { family: data.family } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.light !== undefined ? { light: data.light } : {}),
      ...(data.waterJson !== undefined ? { waterJson: data.waterJson } : {}),
      ...(data.soil !== undefined ? { soil: data.soil } : {}),
      ...(data.tempMinC !== undefined ? { tempMinC: data.tempMinC } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });

  revalidatePath("/rosliny/katalog");
}
