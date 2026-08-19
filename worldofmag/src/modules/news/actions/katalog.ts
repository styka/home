"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { wlasnoscOsobistaDoZapisu, filtrMoichRekordow } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";
import type { NewsCatalogCategory } from "@/lib/news/katalog";

/**
 * 082 — strona UŻYTKOWNIKA systemowej biblioteki źródeł RSS.
 *
 * Katalog jest słownikiem systemowym (bez przestrzeni, bez właściciela), więc odczyt wymaga
 * wyłącznie zalogowania. Zarządzanie katalogiem jest osobne i administratorskie
 * (`src/actions/adminNewsCatalog.ts`) — te dwa zbiory operacji nie mają wspólnego kodu, bo mają
 * różne guardy i różne zakresy danych (użytkownik nie widzi wpisów wyłączonych).
 */

export interface CatalogEntryDTO {
  id: string;
  key: string;
  name: string;
  rssUrl: string;
  homepageUrl: string;
  descriptor: string;
  country: string;
  language: string;
  category: string;
  /** Czy użytkownik ma już to źródło na swojej liście — rozstrzygane po `key`. */
  added: boolean;
}

export interface CatalogFilter {
  q?: string;
  country?: string;
  language?: string;
  category?: string;
}

/**
 * Filtrowanie idzie NA SERWER, a nie do przeglądarki: katalog liczy ponad czterysta wpisów i ma
 * rosnąć, a przeglądarka biblioteki jest oknem z wyszukiwarką, nie listą do przewinięcia.
 */
export async function getSourceCatalog(filter?: CatalogFilter): Promise<CatalogEntryDTO[]> {
  const user = await requireAuth();

  const q = filter?.q?.trim();
  const rows = await prisma.newsSourceCatalog.findMany({
    take: SUFIT_LISTY,
    where: {
      enabled: true,
      ...(filter?.country ? { country: filter.country } : {}),
      ...(filter?.language ? { language: filter.language } : {}),
      ...(filter?.category ? { category: filter.category } : {}),
      // Szukamy po nazwie ORAZ po opisie: użytkownik częściej pamięta, CZYM źródło jest
      // („lewica", „kosmos"), niż jak dokładnie brzmi jego nazwa.
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { descriptor: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ country: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Jedno zapytanie o klucze źródeł użytkownika zamiast sprawdzania wpis po wpisie.
  const moje = await prisma.newsSource.findMany({
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
    select: { key: true },
  });
  const mojeKlucze = new Set(moje.map((s) => s.key));

  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    rssUrl: r.rssUrl,
    homepageUrl: r.homepageUrl,
    descriptor: r.descriptor,
    country: r.country,
    language: r.language,
    category: r.category as NewsCatalogCategory,
    added: mojeKlucze.has(r.key),
  }));
}

/**
 * Dodanie wpisu KOPIUJE jego dane do własnych źródeł użytkownika, a nie tworzy odwołania.
 *
 * Powód: od tej chwili to jest JEGO źródło — może poprawić adres, zmienić opis albo wyłączyć je,
 * i żadna z tych zmian nie ma prawa wrócić do katalogu ani zniknąć, gdy administrator wpis
 * wyłączy. Wspólny byt oznaczałby, że wyłączenie martwego kanału w katalogu kasuje historię
 * artykułów u wszystkich, którzy go czytali.
 */
export async function addSourceFromCatalog(catalogId: string): Promise<void> {
  const user = await requireAuth();
  const wpis = await prisma.newsSourceCatalog.findUnique({ where: { id: catalogId } });
  if (!wpis || !wpis.enabled) throw new Error("Nie ma takiego źródła w bibliotece");

  const wlasnosc = await wlasnoscOsobistaDoZapisu(user.id);
  const istnieje = await prisma.newsSource.findFirst({
    where: { ...wlasnosc, key: wpis.key },
    select: { id: true },
  });
  if (istnieje) throw new Error("To źródło jest już na Twojej liście");

  const max = await prisma.newsSource.aggregate({
    where: { ...wlasnosc },
    _max: { sortOrder: true },
  });
  await prisma.newsSource.create({
    data: {
      ...wlasnosc,
      // Klucz wpisu wędruje razem z danymi — to on odpowiada na „czy już mam to źródło".
      key: wpis.key,
      name: wpis.name,
      rssUrl: wpis.rssUrl,
      homepageUrl: wpis.homepageUrl || wpis.rssUrl,
      descriptor: wpis.descriptor,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/wiadomosci");
}
