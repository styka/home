"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { logAudit } from "@/platform/audit/audit";
import { fetchRss } from "@/lib/news/rss";
import { SUFIT_LISTY } from "@/platform/pagination";
import {
  przytnijPole,
  sprawdzAdresKanalu,
  sprawdzKluczKatalogu,
  normalizujKraj,
  normalizujJezyk,
  normalizujKategorie,
  type NewsCatalogCheckStatus,
} from "@/lib/news/katalog";

/**
 * 082 — zarządzanie SYSTEMOWĄ biblioteką źródeł RSS (`/admin/zrodla-rss`).
 *
 * Plik żyje w `src/actions/`, a nie w module Wiadomości, dokładnie jak `adminCategories.ts` przy
 * słowniku kategorii Zakupów: to są operacje administratora na słowniku systemowym, a nie na
 * danych modułu. Guard jest tu inny (uprawnienie administratora, nie zalogowanie) i zakres danych
 * jest inny (widać wpisy wyłączone), więc wspólny kod z częścią użytkownika byłby wspólnym kodem
 * dwóch różnych reguł dostępu.
 *
 * Usuwanie wpisu jest możliwe, ale DOMYŚLNĄ drogą jest wyłączenie: odwracalne, nie rusza źródeł,
 * które użytkownicy już z tego wpisu dodali (dodanie KOPIUJE dane — patrz `modules/news/actions/
 * katalog.ts`). Dlatego kosz (C-24) tu nie wchodzi: `TrashItem` odzyskuje dane użytkownika,
 * a to jest słownik systemowy.
 */

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
  return session;
}

export interface AdminCatalogEntry {
  id: string;
  key: string;
  name: string;
  rssUrl: string;
  homepageUrl: string;
  descriptor: string;
  country: string;
  language: string;
  category: string;
  enabled: boolean;
  sortOrder: number;
  checkStatus: NewsCatalogCheckStatus;
  checkedAt: string | null;
  checkNote: string;
}

export interface AdminCatalogFilter {
  q?: string;
  country?: string;
  language?: string;
  category?: string;
  /** `true` = tylko wyłączone, `false` = tylko włączone, pominięte = wszystkie. */
  onlyDisabled?: boolean;
}

export async function getCatalogEntries(filter?: AdminCatalogFilter): Promise<AdminCatalogEntry[]> {
  await requireAdmin();
  const q = filter?.q?.trim();
  const rows = await prisma.newsSourceCatalog.findMany({
    take: SUFIT_LISTY,
    where: {
      ...(filter?.country ? { country: filter.country } : {}),
      ...(filter?.language ? { language: filter.language } : {}),
      ...(filter?.category ? { category: filter.category } : {}),
      ...(filter?.onlyDisabled === true ? { enabled: false } : {}),
      ...(filter?.onlyDisabled === false ? { enabled: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { key: { contains: q, mode: "insensitive" as const } },
              { rssUrl: { contains: q, mode: "insensitive" as const } },
              { descriptor: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ country: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    rssUrl: r.rssUrl,
    homepageUrl: r.homepageUrl,
    descriptor: r.descriptor,
    country: r.country,
    language: r.language,
    category: r.category,
    enabled: r.enabled,
    sortOrder: r.sortOrder,
    checkStatus: r.checkStatus as NewsCatalogCheckStatus,
    checkedAt: r.checkedAt ? r.checkedAt.toISOString() : null,
    checkNote: r.checkNote,
  }));
}

export async function createCatalogEntry(data: {
  key: string; name: string; rssUrl: string; homepageUrl?: string; descriptor?: string;
  country?: string; language?: string; category?: string;
}): Promise<void> {
  await requireAdmin();
  const key = sprawdzKluczKatalogu(data.key);
  const name = przytnijPole(data.name);
  if (!name) throw new Error("Nazwa źródła jest wymagana");
  const rssUrl = sprawdzAdresKanalu(data.rssUrl);

  const istnieje = await prisma.newsSourceCatalog.findUnique({ where: { key }, select: { id: true } });
  if (istnieje) throw new Error(`Wpis o kluczu „${key}" już istnieje`);

  await prisma.newsSourceCatalog.create({
    data: {
      key,
      name,
      rssUrl,
      homepageUrl: przytnijPole(data.homepageUrl) || rssUrl,
      descriptor: przytnijPole(data.descriptor),
      country: normalizujKraj(data.country),
      language: normalizujJezyk(data.language),
      category: normalizujKategorie(data.category),
    },
  });
  await logAudit("config", "news.catalog.create", key, `Dodano do biblioteki źródeł: „${name}"`);
  revalidatePath("/admin/zrodla-rss");
  revalidatePath("/wiadomosci");
}

export async function updateCatalogEntry(
  id: string,
  patch: {
    name?: string; rssUrl?: string; homepageUrl?: string; descriptor?: string;
    country?: string; language?: string; category?: string; sortOrder?: number;
  },
): Promise<void> {
  await requireAdmin();
  const wpis = await prisma.newsSourceCatalog.findUnique({ where: { id } });
  if (!wpis) throw new Error("Wpis nie istnieje");

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = przytnijPole(patch.name);
    if (!n) throw new Error("Nazwa źródła jest wymagana");
    data.name = n;
  }
  if (patch.rssUrl !== undefined) data.rssUrl = sprawdzAdresKanalu(patch.rssUrl);
  if (patch.homepageUrl !== undefined) data.homepageUrl = przytnijPole(patch.homepageUrl);
  // Pusty opis jest dozwolony — dlatego sprawdzamy `undefined`, a nie prawdziwość.
  if (patch.descriptor !== undefined) data.descriptor = przytnijPole(patch.descriptor);
  if (patch.country !== undefined) data.country = normalizujKraj(patch.country);
  if (patch.language !== undefined) data.language = normalizujJezyk(patch.language);
  if (patch.category !== undefined) data.category = normalizujKategorie(patch.category);
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

  await prisma.newsSourceCatalog.update({ where: { id }, data });
  await logAudit("config", "news.catalog.update", wpis.key, `Zmieniono wpis biblioteki: „${wpis.name}"`);
  revalidatePath("/admin/zrodla-rss");
  revalidatePath("/wiadomosci");
}

export async function setCatalogEntryEnabled(id: string, enabled: boolean): Promise<void> {
  await requireAdmin();
  const wpis = await prisma.newsSourceCatalog.findUnique({ where: { id } });
  if (!wpis) throw new Error("Wpis nie istnieje");
  await prisma.newsSourceCatalog.update({ where: { id }, data: { enabled } });
  await logAudit(
    "config",
    enabled ? "news.catalog.enable" : "news.catalog.disable",
    wpis.key,
    `${enabled ? "Włączono" : "Wyłączono"} w bibliotece: „${wpis.name}"`,
  );
  revalidatePath("/admin/zrodla-rss");
  revalidatePath("/wiadomosci");
}

export async function deleteCatalogEntry(id: string): Promise<void> {
  await requireAdmin();
  const wpis = await prisma.newsSourceCatalog.findUnique({ where: { id } });
  if (!wpis) throw new Error("Wpis nie istnieje");
  await prisma.newsSourceCatalog.delete({ where: { id } });
  await logAudit("config", "news.catalog.delete", wpis.key, `Usunięto z biblioteki: „${wpis.name}"`);
  revalidatePath("/admin/zrodla-rss");
  revalidatePath("/wiadomosci");
}

export interface CatalogCheckResult {
  status: NewsCatalogCheckStatus;
  note: string;
  checkedAt: string;
}

/**
 * Sprawdzenie kanału jest NA ŻĄDANIE, nie w tle. Katalog liczy ponad czterysta pozycji, więc
 * cykliczne odpytywanie wszystkich byłoby stałym ruchem sieciowym za rzecz, którą administrator
 * robi kilka razy w roku. `fetchRss` połyka błędy sieci i zwraca pustą listę — dlatego „zero
 * pozycji" jest tu traktowane jako błąd, a nie jako pusty kanał: dla wpisu w bibliotece to jedno
 * i to samo, bo taki wpis i tak nie ma czego dostarczyć.
 */
export async function checkCatalogEntry(id: string): Promise<CatalogCheckResult> {
  await requireAdmin();
  const wpis = await prisma.newsSourceCatalog.findUnique({ where: { id } });
  if (!wpis) throw new Error("Wpis nie istnieje");

  const feed = await fetchRss(wpis.rssUrl);
  const status: NewsCatalogCheckStatus = feed.length > 0 ? "ok" : "error";
  const note =
    feed.length > 0
      ? `Kanał odpowiedział, pozycji: ${feed.length}`
      : "Kanał nie odpowiedział albo nie zwrócił żadnej pozycji";
  const checkedAt = new Date();

  await prisma.newsSourceCatalog.update({
    where: { id },
    data: { checkStatus: status, checkNote: note, checkedAt },
  });
  revalidatePath("/admin/zrodla-rss");
  revalidatePath("/wiadomosci");
  return { status, note, checkedAt: checkedAt.toISOString() };
}

export interface CatalogExport {
  omniaNewsCatalog: 1;
  exportedAt: string;
  entries: {
    key: string; name: string; rssUrl: string; homepageUrl: string; descriptor: string;
    country: string; language: string; category: string; enabled: boolean; sortOrder: number;
  }[];
}

export async function exportCatalog(): Promise<CatalogExport> {
  await requireAdmin();
  const rows = await prisma.newsSourceCatalog.findMany({
    take: SUFIT_LISTY,
    orderBy: [{ country: "asc" }, { sortOrder: "asc" }],
    select: {
      key: true, name: true, rssUrl: true, homepageUrl: true, descriptor: true,
      country: true, language: true, category: true, enabled: true, sortOrder: true,
    },
  });
  return { omniaNewsCatalog: 1, exportedAt: new Date().toISOString(), entries: rows };
}

/**
 * Import DOPISUJE brakujące i nigdy nie nadpisuje istniejących — ta sama reguła co w seedzie
 * migracyjnym i z tego samego powodu: wpis bywa poprawiany dlatego, że wersja z pliku przestała
 * działać, więc przywrócenie jej byłoby cofnięciem naprawy. Ponowny import tego samego pliku
 * kończy się więc `added: 0`, a nie duplikatami.
 */
export async function importCatalog(json: string): Promise<{ added: number; skipped: number }> {
  await requireAdmin();
  let dane: unknown;
  try {
    dane = JSON.parse(json);
  } catch {
    throw new Error("To nie jest poprawny plik JSON");
  }
  const paczka = dane as Partial<CatalogExport>;
  if (paczka?.omniaNewsCatalog !== 1 || !Array.isArray(paczka.entries)) {
    throw new Error("Plik nie jest eksportem biblioteki źródeł Omnii");
  }

  /**
   * Walidacja w pamięci, a potem **JEDEN** zapis.
   *
   * Wersja z `createMany` w pętli robiła jedno zapytanie na wpis — dla pliku wyeksportowanego
   * z tego katalogu to 419 podróży do bazy. Na lokalnym Postgresie niezauważalne, na Neonie
   * (baza zdalna, kilkadziesiąt ms na podróż) to kilkanaście sekund, czyli akcja serwerowa, która
   * zdąży się przekroczyć zanim skończy. Wejściem jest tu **własny eksport**, więc duży plik to
   * przypadek typowy, nie skrajny.
   */
  const dobre: {
    key: string; name: string; rssUrl: string; homepageUrl: string; descriptor: string;
    country: string; language: string; category: string; enabled: boolean; sortOrder: number;
  }[] = [];
  const widziane = new Set<string>();
  let odrzucone = 0;

  for (const e of paczka.entries) {
    let key: string;
    let rssUrl: string;
    try {
      key = sprawdzKluczKatalogu(String(e?.key ?? ""));
      rssUrl = sprawdzAdresKanalu(String(e?.rssUrl ?? ""));
    } catch {
      odrzucone++;
      continue;
    }
    const name = przytnijPole(String(e?.name ?? ""));
    // Powtórka klucza W OBRĘBIE PLIKU odsiewana tutaj, a nie zostawiona bazie: `ON CONFLICT` co
    // prawda ją przełknie, ale wtedy liczba „pominiętych" nie powiedziałaby, dlaczego.
    if (!name || widziane.has(key)) {
      odrzucone++;
      continue;
    }
    widziane.add(key);
    dobre.push({
      key,
      name,
      rssUrl,
      homepageUrl: przytnijPole(e?.homepageUrl) || rssUrl,
      descriptor: przytnijPole(e?.descriptor),
      country: normalizujKraj(e?.country),
      language: normalizujJezyk(e?.language),
      category: normalizujKategorie(e?.category),
      enabled: e?.enabled !== false,
      sortOrder: Number.isFinite(e?.sortOrder) ? Number(e?.sortOrder) : 0,
    });
  }

  // `skipDuplicates` = `ON CONFLICT ("key") DO NOTHING` — ta sama reguła co w seedzie migracyjnym:
  // wpis, który już jest, zostaje TAKI, JAKI JEST (poprawka administratora nie może się cofnąć).
  const wynik = dobre.length > 0
    ? await prisma.newsSourceCatalog.createMany({ data: dobre, skipDuplicates: true })
    : { count: 0 };
  const added = wynik.count;
  const skipped = paczka.entries.length - added;

  // W dzienniku rozróżniamy DWA powody pominięcia, bo znaczą co innego: „już był" to normalny
  // wynik ponownego importu, a „odrzucony" to wpis, którego plik nie niósł poprawnie.
  await logAudit(
    "config",
    "news.catalog.import",
    null,
    `Import biblioteki: dodano ${added}, pominięto ${skipped} (w tym ${odrzucone} odrzuconych przy walidacji)`,
  );
  revalidatePath("/admin/zrodla-rss");
  revalidatePath("/wiadomosci");
  return { added, skipped };
}
