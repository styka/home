"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";
import { recordTrash } from "@/platform/trash/trash";
import { getLocations } from "@/modules/weather/contract";
import { logEvent } from "@/platform/observability/log";
import { requireRoslinyAccess, zakresPrzestrzeni } from "../lib/sharingGuard";
import { trybLubDomyslny } from "../domain/agenda";
import type { TrybPrzestrzeni } from "../lib/typy";

/**
 * 113 — PRZESTRZENIE ROŚLINNE.
 *
 * **Przestrzeń roślinna to NIE jest `Workspace`.** To byt wewnątrz modułu — wzorzec `Workshop`
 * w Warsztatach i `Store` w Zakupach. Jedna przestrzeń własnościowa (`Workspace`) mieści ich wiele,
 * i o to właśnie chodziło właścicielowi: kwiaciarnia i prywatny ogród istnieją JEDNOCZEŚNIE
 * w jednym koncie, a każde ma swój tryb.
 */

export interface PrzestrzenDTO {
  id: string;
  name: string;
  kind: TrybPrzestrzeni;
  weatherLocationId: string | null;
  notes: string | null;
  liczbaRoslin: number;
  liczbaMiejsc: number;
  zespol: { id: string; name: string } | null;
}

export async function getSpaces(): Promise<PrzestrzenDTO[]> {
  const user = await requireAuth();
  const spaces = await prisma.plantSpace.findMany({
    take: SUFIT_LISTY,
    // Zakres obejmuje przestrzenie NADANE, nie tylko własne — inaczej udostępniona przestrzeń
    // nie pojawia się na liście, mimo że guard wpuszcza do jej widoku (AC-28).
    where: await zakresPrzestrzeni(user.id),
    include: {
      workspace: { select: { team: { select: { id: true, name: true } } } },
      _count: { select: { places: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  // Liczymy tylko rośliny AKTYWNE: licznik przy przestrzeni odpowiada na pytanie „ile mam",
  // a nie „ile kiedykolwiek miałem". Zakończone zostają w historii miejsca i w statystykach.
  const aktywne = await prisma.plant.groupBy({
    by: ["spaceId"],
    where: { spaceId: { in: spaces.map((s) => s.id) }, status: "ACTIVE" },
    _count: { _all: true },
  });
  const wgPrzestrzeni = new Map(aktywne.map((a) => [a.spaceId, a._count._all]));

  return spaces.map((s) => ({
    id: s.id,
    name: s.name,
    kind: trybLubDomyslny(s.kind),
    weatherLocationId: s.weatherLocationId,
    notes: s.notes,
    liczbaRoslin: wgPrzestrzeni.get(s.id) ?? 0,
    liczbaMiejsc: s._count.places,
    zespol: s.workspace?.team ?? null,
  }));
}

export async function getSpace(id: string): Promise<PrzestrzenDTO | null> {
  const user = await requireAuth();
  await assertSpaceAccess(id, user.id);

  const s = await prisma.plantSpace.findUnique({
    where: { id },
    include: {
      workspace: { select: { team: { select: { id: true, name: true } } } },
      _count: { select: { places: true } },
    },
  });
  if (!s) return null;

  const liczbaRoslin = await prisma.plant.count({ where: { spaceId: id, status: "ACTIVE" } });

  return {
    id: s.id,
    name: s.name,
    kind: trybLubDomyslny(s.kind),
    weatherLocationId: s.weatherLocationId,
    notes: s.notes,
    liczbaRoslin,
    liczbaMiejsc: s._count.places,
    zespol: s.workspace?.team ?? null,
  };
}

/**
 * Rzuca, jeśli użytkownik nie ma dostępu do przestrzeni.
 *
 * Cienka nakładka na dwie operacje deklaracji — reguła (własność, zespół, nadania, dziedziczenie)
 * mieszka w jednym miejscu dla całej aplikacji (C-17). Rozróżnienie „nie istnieje" od „brak
 * dostępu" zostaje, bo niesie więcej i nie ma powodu go tracić.
 */
export async function assertSpaceAccess(spaceId: string, userId: string, needEdit = false): Promise<void> {
  const istnieje = await prisma.plantSpace.findUnique({ where: { id: spaceId }, select: { id: true } });
  if (!istnieje) throw new Error("Przestrzeń nie istnieje");
  try {
    await requireRoslinyAccess(userId, { type: "rosliny.space", id: spaceId }, needEdit ? "space.edit" : "space.read");
  } catch {
    throw new Error(needEdit ? "Masz dostęp tylko do odczytu" : "Brak dostępu do przestrzeni");
  }
}

export async function createSpace(data: {
  name: string;
  kind?: TrybPrzestrzeni;
  weatherLocationId?: string | null;
  notes?: string | null;
  teamId?: string | null;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  const nazwa = data.name?.trim();
  if (!nazwa) throw new Error("Nazwa przestrzeni jest wymagana");

  const space = await prisma.plantSpace.create({
    data: {
      ...(await wlasnoscDoZapisu(user.id, data.teamId)),
      name: nazwa,
      kind: trybLubDomyslny(data.kind),
      weatherLocationId: data.weatherLocationId ?? null,
      notes: data.notes ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/rosliny");
  return space;
}

export async function updateSpace(
  id: string,
  data: { name?: string; kind?: TrybPrzestrzeni; weatherLocationId?: string | null; notes?: string | null },
): Promise<void> {
  const user = await requireAuth();
  await assertSpaceAccess(id, user.id, true);

  await prisma.plantSpace.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.kind !== undefined ? { kind: trybLubDomyslny(data.kind) } : {}),
      ...(data.weatherLocationId !== undefined ? { weatherLocationId: data.weatherLocationId } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });

  revalidatePath("/rosliny");
  revalidatePath(`/rosliny/${id}`);
}

/**
 * Usuwa przestrzeń — do kosza, nie na twardo (C-24).
 *
 * Snapshot niesie **całą** przestrzeń razem z miejscami i roślinami, bo kaskada FK skasuje je
 * fizycznie. Przywrócenie samej przestrzeni bez zawartości byłoby przywróceniem pustej nazwy.
 */
export async function deleteSpace(id: string): Promise<void> {
  const user = await requireAuth();
  await assertSpaceAccess(id, user.id, true);

  const space = await prisma.plantSpace.findUnique({
    where: { id },
    include: {
      // paginacja: kompletny — migawka musi zawierać WSZYSTKO, co kaskada usunie. Ucięta lista
      // dałaby przywrócenie, które po cichu gubi dane, a wpis kosza jest po przywróceniu kasowany,
      // więc drugiej szansy nie ma.
      //
      // **`careEvents` jest tu najważniejsze i najłatwiejsze do przeoczenia**: to w nich siedzi
      // ewidencja zabiegów środkami ochrony roślin. `retention.ts` wyłącza ją z automatycznego
      // usuwania jako dokumentację o wymogu ustawowym — a bez tej linii jedno kliknięcie
      // „usuń przestrzeń" niszczyłoby ją skuteczniej niż jakikolwiek automat.
      places: true,
      // **`plants: true` NIE wystarcza** — zwraca same wiersze rośliny, a kaskada
      // (`Plant.space → Cascade`, dalej `journal`/`measurements`/`healthEvents` → `Cascade`)
      // usuwa też wszystko, co pod nią wisi. Bez zagnieżdżenia pętla przywracająca dzieci czytała
      // `undefined`, czyli była no-opem, który w kodzie wyglądał na pokrycie: „usuń roślinę →
      // przywróć" działało, „usuń przestrzeń → przywróć" gubiło rok zdjęć i pomiarów.
      plants: { include: { journal: true, measurements: true, healthEvents: true } },
      careTasks: true,
      careEvents: true,
    },
  });
  if (!space) throw new Error("Przestrzeń nie istnieje");

  await recordTrash(user.id, {
    module: "rosliny",
    entityId: space.id,
    title: `Przestrzeń roślinna: ${space.name}`,
    payload: { rodzaj: "plantSpace", space },
  });

  await prisma.plantSpace.delete({ where: { id } });

  revalidatePath("/rosliny");
  revalidatePath("/trash");
}

/**
 * Lokalizacje pogodowe do wyboru przy przestrzeni (AC-11).
 *
 * **Passthrough przez kontrakt Pogody, nie własna lista.** Moduł nie zna ani tabeli lokalizacji, ani
 * sposobu ich zakładania — pyta ten moduł, który je ma. Gdy Pogoda jest niedostępna albo użytkownik
 * nie ma tam żadnej lokalizacji, wracamy z pustą listą: brak lokalizacji ma wyłączyć korektę
 * pogodową, a nie zablokować ustawienia przestrzeni.
 */
export async function getWeatherOptions(): Promise<{ id: string; label: string }[]> {
  await requireAuth();
  try {
    return (await getLocations()).map((l) => ({ id: l.id, label: l.label }));
  } catch (e) {
    logEvent("warn", "rosliny/lokalizacje.niedostepne", {
      powod: e instanceof Error ? e.message : "nieznany",
    });
    return [];
  }
}
