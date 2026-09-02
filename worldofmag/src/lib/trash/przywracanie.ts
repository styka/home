/**
 * 117: RESTORATORY KOSZA — wyniesione z `src/actions/trash.ts` (plik `"use server"` może
 * eksportować wyłącznie akcje), bo od 117 przywracają DWIE drogi: użytkownik w `/trash`
 * i admin w `/admin/kosz`. Jeden dispatch, żeby obie drogi odtwarzały identycznie.
 *
 * `wlascicielId` to zawsze WŁAŚCICIEL wpisu kosza (`TrashItem.userId`), nie osoba klikająca:
 * admin przywraca zasób użytkownikowi, więc fallbacki własności nie mogą sięgać po sesję.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/platform/db/prisma";
import { SUFIT_LISTY } from "@/platform/pagination";
// Odczyt migawki rośliny jest REGUŁĄ modułu Rośliny (co wolno uzupełnić domyślną, a czego nie),
// więc bierzemy go z jego kontraktu razem z testem, który tam mieszka.
import { wierszRoslinyZMigawki } from "@/modules/rosliny/contract";
// 117: kolejność rodzic→dziecko przy odtwarzaniu drzewa obszarów jest regułą modułu Zadania.
import { sortujTopologicznie } from "@/modules/tasks/contract";
import {
  przestrzenOsobista,
  przestrzenZespoluBezKontroliDostepu,
  filtrMoichRekordow,
} from "@/platform/workspaces/zapis";

export interface WpisKosza {
  entityId: string;
  module: string;
  userId: string;
  payload: string;
}

/** Jeden dispatch dla obu dróg przywracania (użytkownik i admin). Rzuca na nieznanym typie. */
export async function przywrocZMigawki(item: WpisKosza): Promise<void> {
  const data = JSON.parse(item.payload) as Record<string, unknown>;
  if (item.module === "notes") await restoreNote(data, item.userId);
  else if (item.module === "tasks") await restoreTask(data);
  else if (item.module === "weather") await restoreWeatherIdea(data, item.userId);
  else if (item.module === "youtube") await restoreYoutubeChannel(data);
  else if (item.module === "czat") await restoreChatMessage(data, item.userId);
  else if (item.module === "rosliny") await restoreRosliny(data);
  else if (item.module === "contacts") await restoreContact(data, item.userId);
  else if (item.module === "habits") await restoreHabit(data, item.userId);
  else if (item.module === "obszary") await restoreObszary(data, item.entityId);
  else throw new Error("Nieobsługiwany typ pozycji");
}

// ─── Restoratory per moduł ───────────────────────────────────────────────────

function asDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 078 (zadanie 11, etap 4 część 2) — GDZIE PRZYWRÓCIĆ REKORD Z KOSZA.
 *
 * **To jest jedyne miejsce w konwersji, w którym problemem nie jest kod, a DANE JUŻ ZAPISANE.**
 * Migawka w `TrashItem.payload` to JSON utrwalony w chwili usunięcia rekordu. Migawki zrobione
 * przed 078 zawierają wyłącznie `ownerId`/`ownerTeamId` — pola `workspaceId` w nich nie ma i nigdy
 * nie będzie, bo nikt ich wstecz nie przepisze. Gdyby przywracanie czytało tylko nową kolumnę,
 * to w dniu usunięcia kolumn własnościowych **każdy rekord leżący w koszu przestałby dać się
 * przywrócić na swoje miejsce**. Dlatego kolejność jest: najpierw przestrzeń z migawki, a gdy
 * jej nie ma — wyprowadzenie z kolumn własnościowych, jak robił to wyzwalacz 0236/0238.
 *
 * 117: ostatni fallback to przestrzeń osobista WŁAŚCICIELA WPISU (`wlascicielId`), nie sesji —
 * admin przywracający cudzy zasób nie może stać się jego właścicielem.
 */
async function przestrzenZMigawki(
  d: Record<string, unknown>,
  wlascicielId: string,
): Promise<{ workspaceId: string }> {
  const zMigawki = (d.workspaceId as string | null) ?? null;
  if (zMigawki) return { workspaceId: zMigawki };

  const ownerId = (d.ownerId as string | null) ?? null;
  const ownerTeamId = (d.ownerTeamId as string | null) ?? null;
  const workspaceId = ownerTeamId
    ? await przestrzenZespoluBezKontroliDostepu(ownerTeamId)
    : await przestrzenOsobista(ownerId ?? wlascicielId);
  return { workspaceId };
}

/**
 * 079: wariant „dla tabel o `ownerId NOT NULL`" STRACIŁ PRZEDMIOT — takich tabel nie ma, bo nie ma
 * kolumny. Nazwa zostaje jako pojedyncze miejsce wywołania w restauratorze `WeatherIdea`.
 */
async function przestrzenZMigawkiOsobista(
  d: Record<string, unknown>,
  wlascicielId: string,
): Promise<{ workspaceId: string }> {
  return przestrzenZMigawki(d, wlascicielId);
}

async function restoreNote(d: Record<string, unknown>, wlascicielId: string): Promise<void> {
  const id = d.id as string;
  // Nie duplikuj, jeśli notatka o tym id już istnieje.
  const exists = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (exists) return;

  // Grupa mogła zniknąć — przywróć bez grupy, jeśli nie istnieje.
  let groupId = (d.groupId as string | null) ?? null;
  if (groupId) {
    const g = await prisma.noteGroup.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!g) groupId = null;
  }

  await prisma.note.create({
    data: {
      id,
      title: (d.title as string) ?? "Przywrócona notatka",
      content: (d.content as string) ?? "",
      isMarkdown: (d.isMarkdown as boolean) ?? false,
      pinned: (d.pinned as boolean) ?? false,
      groupId,
      ...(await przestrzenZMigawki(d, wlascicielId)),
      createdAt: asDate(d.createdAt) ?? new Date(),
    },
  });

  // Re-link tagów, które wciąż istnieją.
  const tagIds = (d.tagIds as string[] | undefined) ?? [];
  if (tagIds.length) {
    const existing = await prisma.tag.findMany({ take: SUFIT_LISTY, where: { id: { in: tagIds } }, select: { id: true } });
    if (existing.length) {
      await prisma.noteTag.createMany({
        data: existing.map((t) => ({ noteId: id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }
}

/** 114: kontakt — płaski rekord, wraca w całości z migawki. */
async function restoreContact(d: Record<string, unknown>, wlascicielId: string): Promise<void> {
  const id = d.id as string;
  if (!id) throw new Error("Uszkodzona migawka kontaktu");
  const exists = await prisma.contact.findUnique({ where: { id }, select: { id: true } });
  if (exists) return;
  await prisma.contact.create({
    data: {
      id,
      name: (d.name as string) ?? "Przywrócony kontakt",
      phone: (d.phone as string | null) ?? null,
      email: (d.email as string | null) ?? null,
      company: (d.company as string | null) ?? null,
      birthday: asDate(d.birthday),
      tags: (d.tags as string | null) ?? null,
      notes: (d.notes as string | null) ?? null,
      ...(await przestrzenZMigawki(d, wlascicielId)),
      createdAt: asDate(d.createdAt) ?? new Date(),
    },
  });
}

/** 114: nawyk wraz z dziennikiem wykonań (kaskada zabrała go razem z definicją). */
async function restoreHabit(d: Record<string, unknown>, wlascicielId: string): Promise<void> {
  const id = d.id as string;
  if (!id) throw new Error("Uszkodzona migawka nawyku");
  const exists = await prisma.habit.findUnique({ where: { id }, select: { id: true } });
  if (exists) return;
  await prisma.habit.create({
    data: {
      id,
      name: (d.name as string) ?? "Przywrócony nawyk",
      description: (d.description as string | null) ?? null,
      icon: (d.icon as string) ?? "✅",
      color: (d.color as string) ?? "var(--accent-orange)",
      daysOfWeek: (d.daysOfWeek as string | null) ?? null,
      weeklyGoal: (d.weeklyGoal as number | null) ?? null,
      reminderTime: (d.reminderTime as string | null) ?? null,
      archived: (d.archived as boolean) ?? false,
      sortOrder: (d.sortOrder as number) ?? 0,
      ...(await przestrzenZMigawki(d, wlascicielId)),
      createdAt: asDate(d.createdAt) ?? new Date(),
    },
  });
  const wpisy = (d.entries as Record<string, unknown>[] | undefined) ?? [];
  if (wpisy.length > 0) {
    await prisma.habitEntry.createMany({
      data: wpisy
        .filter((w) => typeof w.date === "string")
        .map((w) => ({ id: w.id as string, habitId: id, date: w.date as string, createdAt: asDate(w.createdAt) ?? new Date() })),
      skipDuplicates: true,
    });
  }
}

async function restoreTask(d: Record<string, unknown>): Promise<void> {
  const id = d.id as string;
  const exists = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (exists) return;

  // Projekt/parent mogły zniknąć — wyzeruj nieistniejące referencje.
  let projectId = (d.projectId as string | null) ?? null;
  if (projectId) {
    const p = await prisma.taskProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!p) projectId = null;
  }
  let parentTaskId = (d.parentTaskId as string | null) ?? null;
  if (parentTaskId) {
    const p = await prisma.task.findUnique({ where: { id: parentTaskId }, select: { id: true } });
    if (!p) parentTaskId = null;
  }
  // 117: obszar wraca tylko, gdy nadal istnieje w projekcie zadania (mógł zostać usunięty osobno).
  let areaId = (d.areaId as string | null) ?? null;
  if (areaId) {
    const a = await prisma.taskArea.findUnique({ where: { id: areaId }, select: { projectId: true } });
    if (!a || a.projectId !== projectId) areaId = null;
  }

  await prisma.task.create({
    data: {
      id,
      title: (d.title as string) ?? "Przywrócone zadanie",
      description: (d.description as string | null) ?? null,
      status: (d.status as string) ?? "TODO",
      priority: (d.priority as string) ?? "NONE",
      dueDate: asDate(d.dueDate),
      startDate: asDate(d.startDate),
      completedAt: asDate(d.completedAt),
      estimatedMins: (d.estimatedMins as number | null) ?? null,
      recurring: (d.recurring as string | null) ?? null,
      category: (d.category as string) ?? "Other",
      order: (d.order as number) ?? 0,
      projectId,
      areaId,
      parentTaskId,
      createdById: (d.createdById as string | null) ?? null,
      assigneeId: (d.assigneeId as string | null) ?? null,
      createdAt: asDate(d.createdAt) ?? new Date(),
    },
  });

  const tagIds = (d.tagIds as string[] | undefined) ?? [];
  if (tagIds.length) {
    const existing = await prisma.taskTagDef.findMany({ take: SUFIT_LISTY, where: { id: { in: tagIds } }, select: { id: true } });
    if (existing.length) {
      await prisma.taskTaskTag.createMany({
        data: existing.map((t) => ({ taskId: id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }
}

/**
 * 117: obszar (lub poddrzewo) z modułu Zadania.
 *
 * Odtwarzamy węzły topologicznie (rodzic przed dzieckiem — `createMany` wstawia w kolejności
 * tablicy, a FK sprawdza per wiersz) i przypinamy z powrotem zadania. Przypięcie NIE kradnie:
 * wraca tylko zadanie, którego bieżący obszar jest dokładnie tym, co zostawiło usunięcie
 * (`null` po trybie „poddrzewo", obszar nadrzędny po „scal") — ręczne przenosiny z międzyczasu
 * zostają nietknięte.
 */
async function restoreObszary(d: Record<string, unknown>, korzenId: string): Promise<void> {
  const projectId = (d.projectId as string) ?? null;
  const areas = (d.areas as Record<string, unknown>[] | undefined) ?? [];
  if (!projectId || areas.length === 0) throw new Error("Uszkodzona migawka obszaru");

  const projekt = await prisma.taskProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!projekt) throw new Error("Projekt tych obszarów już nie istnieje");

  const wezly = areas.map((a) => ({
    id: a.id as string,
    parentId: (a.parentId as string | null) ?? null,
    name: (a.name as string) ?? "Obszar",
    order: (a.order as number) ?? 0,
  }));
  const wMigawce = new Set(wezly.map((w) => w.id));

  // Rodzic spoza migawki (rodzic scalonego korzenia / rodzic korzenia poddrzewa) wraca tylko,
  // gdy nadal istnieje — inaczej węzeł ląduje na szczycie zamiast wywalić cały zapis na FK.
  const zewnetrzni = Array.from(
    new Set(wezly.map((w) => w.parentId).filter((p): p is string => p !== null && !wMigawce.has(p))),
  );
  const istniejacy = new Set(
    zewnetrzni.length > 0
      ? (
          // paginacja: kompletny — test istnienia dla skończonej listy id z migawki.
          await prisma.taskArea.findMany({ where: { id: { in: zewnetrzni } }, select: { id: true } })
        ).map((r) => r.id)
      : [],
  );

  await prisma.taskArea.createMany({
    data: sortujTopologicznie(wezly).map((w) => ({
      id: w.id,
      projectId,
      parentId: w.parentId !== null && (wMigawce.has(w.parentId) || istniejacy.has(w.parentId)) ? w.parentId : null,
      name: w.name,
      order: w.order,
    })),
    skipDuplicates: true,
  });

  // Stan, jaki zostawiło usunięcie: „scal" przepiął zadania na rodzica korzenia, „poddrzewo"
  // wyzerował (`SetNull`). Dopuszczamy też `null` przy „scal" — rodzic mógł zniknąć później.
  const tryb = (d.tryb as string) ?? "poddrzewo";
  const korzen = wezly.find((w) => w.id === korzenId);
  const poScaleniu = tryb === "scal" ? korzen?.parentId ?? null : null;

  // Recenzja 117 (ust. 2): „scal" przepiął pod-obszary korzenia na dziadka — przywrócenie
  // przepina je z powrotem, ale tylko te, które NADAL wiszą tam, gdzie zostawiło je usunięcie
  // (ten sam wzorzec „nie kradnij" co przy zadaniach: ręczne przenosiny z międzyczasu zostają).
  const childIds = (d.childIds as string[] | undefined) ?? [];
  if (tryb === "scal" && childIds.length > 0) {
    await prisma.taskArea.updateMany({
      where: { id: { in: childIds }, projectId, parentId: poScaleniu },
      data: { parentId: korzenId },
    });
  }

  const przypisania = (d.taskAssignments as { taskId?: unknown; areaId?: unknown }[] | undefined) ?? [];
  const poObszarze = new Map<string, string[]>();
  for (const p of przypisania) {
    if (typeof p?.taskId !== "string" || typeof p?.areaId !== "string") continue;
    const lista = poObszarze.get(p.areaId) ?? [];
    lista.push(p.taskId);
    poObszarze.set(p.areaId, lista);
  }
  const wpisy = Array.from(poObszarze.entries());
  for (const [areaId, taskIds] of wpisy) {
    await prisma.task.updateMany({
      where: {
        id: { in: taskIds },
        projectId,
        OR: [{ areaId: null }, ...(poScaleniu !== null ? [{ areaId: poScaleniu }] : [])],
      },
      data: { areaId },
    });
  }
}

/**
 * 102 (AC-18): przywrócenie obserwowanego kanału YouTube.
 *
 * Przywracamy sam kanał, nie jego filmy — te znikły kaskadą przy usunięciu i **dobiorą się same**
 * przy najbliższym odświeżeniu.
 */
async function restoreYoutubeChannel(d: Record<string, unknown>): Promise<void> {
  const ownerId = d.ownerId as string;
  const channelId = d.channelId as string;
  if (!ownerId || !channelId) throw new Error("Uszkodzona migawka kanału");

  await prisma.youtubeChannel.createMany({
    data: [
      {
        ...(await filtrMoichRekordow(ownerId)),
        channelId,
        title: (d.title as string) ?? channelId,
        handle: (d.handle as string | null) ?? null,
        thumbnailUrl: (d.thumbnailUrl as string | null) ?? null,
        zrodlo: (d.zrodlo as string) ?? "reczne",
      },
    ],
    // Kanał mógł w międzyczasie wrócić inną drogą (import subskrypcji) — wtedy przywrócenie jest
    // bezprzedmiotowe, a nie błędne.
    skipDuplicates: true,
  });
}

/**
 * 037: propozycja „co robić" z modułu Pogoda.
 *
 * Uwaga na klucz unikalny po fingerprincie: jeśli po usunięciu użytkownik zdążył ponownie
 * zablokować lub obejrzeć propozycję o tej samej nazwie, wiersz już istnieje. Przywracamy wtedy
 * tylko treść, której nowy wiersz nie ma (szczegóły).
 */
async function restoreWeatherIdea(d: Record<string, unknown>, wlascicielId: string): Promise<void> {
  const id = d.id as string;
  const ownerId = (d.ownerId as string) ?? wlascicielId;
  const fingerprint = d.fingerprint as string;
  if (!ownerId || !fingerprint) throw new Error("Uszkodzona migawka propozycji");

  const clash = await prisma.weatherIdea.findUnique({
    where: { workspaceId_fingerprint: { ...(await filtrMoichRekordow(ownerId)), fingerprint } },
    select: { id: true, detail: true },
  });
  if (clash) {
    if (!clash.detail && d.detail) {
      await prisma.weatherIdea.update({
        where: { id: clash.id },
        data: {
          detail: d.detail as string,
          detailAt: asDate(d.detailAt),
          detailRuns: (d.detailRuns as number) ?? 0,
          detailUsage: (d.detailUsage as string | null) ?? null,
        },
      });
    }
    return;
  }

  await prisma.weatherIdea.create({
    data: {
      id,
      ...(await przestrzenZMigawkiOsobista(d, wlascicielId)),
      fingerprint,
      title: (d.title as string) ?? "Przywrócony pomysł",
      summary: (d.summary as string) ?? "",
      category: (d.category as string) ?? "other",
      state: (d.state as string) ?? "considered",
      locationLabel: (d.locationLabel as string) ?? "",
      lat: (d.lat as number) ?? 0,
      lon: (d.lon as number) ?? 0,
      detail: (d.detail as string | null) ?? null,
      detailAt: asDate(d.detailAt),
      detailRuns: (d.detailRuns as number) ?? 0,
      detailUsage: (d.detailUsage as string | null) ?? null,
      viewCount: (d.viewCount as number) ?? 0,
      lastSeenAt: asDate(d.lastSeenAt) ?? new Date(),
      createdAt: asDate(d.createdAt) ?? new Date(),
    },
  });
}

/**
 * 107: przywrócenie własnej wiadomości z czatu.
 *
 * Usunięcie było miękkie, więc przywracamy przez **zdjęcie znacznika**, a nie przez utworzenie
 * nowego wiersza. Warunek autorstwa jest w zapytaniu: to zapis do wspólnej rozmowy i pochodzenie
 * migawki nie może być jedyną obroną.
 */
async function restoreChatMessage(d: Record<string, unknown>, userId: string): Promise<void> {
  const id = d.id as string;
  if (!id) throw new Error("Uszkodzona migawka wiadomości");
  await prisma.chatMessage.updateMany({
    where: { id, autorId: userId },
    data: { deletedAt: null },
  });
}

/**
 * 113: dziecko rośliny przywracane z migawki — dziennik, pomiary i zdarzenia zdrowotne.
 *
 * **Bez tego przywrócenie oddawało pusty wiersz.** `deletePlant` zbiera te trzy kolekcje właśnie
 * dlatego, że kaskada je kasuje; pominięcie ich przy odtwarzaniu znaczyło, że użytkownik odzyskuje
 * nazwę rośliny i traci rok zdjęć.
 */
async function przywrocDzieciRosliny(
  tx: Prisma.TransactionClient,
  p: Record<string, unknown>,
): Promise<void> {
  const wpisy = (p.journal as Record<string, unknown>[]) ?? [];
  const pomiary = (p.measurements as Record<string, unknown>[]) ?? [];
  const zdrowie = (p.healthEvents as Record<string, unknown>[]) ?? [];
  // Harmonogram opieki: przy migawce POJEDYNCZEJ rośliny (`deletePlant` zbiera `careTasks`).
  // W migawce przestrzeni zadania leżą na poziomie `space.careTasks` i przywraca je tamta gałąź —
  // tu lista jest wtedy pusta i to jest poprawny no-op, nie dziura.
  const zadaniaOpieki = (p.careTasks as Record<string, unknown>[]) ?? [];
  if (zadaniaOpieki.length > 0) {
    // Wskazanie miejsca wraca tylko wtedy, gdy miejsce nadal istnieje — inaczej klucz obcy
    // odrzuciłby cały zapis (miejsce mogło zostać usunięte osobno, jego FK to SET NULL).
    const wskazaneMiejsca = Array.from(
      new Set(zadaniaOpieki.map((z) => z.placeId).filter((x): x is string => typeof x === "string")),
    );
    const istniejaceMiejsca = new Set(
      wskazaneMiejsca.length > 0
        ? (
            // paginacja: kompletny — to test istnienia dla skończonej listy id z migawki;
            // ucięty wynik odpinałby zadania od miejsc, które wciąż istnieją.
            await tx.plantPlace.findMany({ where: { id: { in: wskazaneMiejsca } }, select: { id: true } })
          ).map((m) => m.id)
        : [],
    );
    await tx.plantCareTask.createMany({
      data: zadaniaOpieki.map((z) => ({
        id: z.id as string,
        spaceId: z.spaceId as string,
        plantId: (z.plantId as string | null) ?? null,
        placeId: typeof z.placeId === "string" && istniejaceMiejsca.has(z.placeId) ? z.placeId : null,
        kind: (z.kind as string) ?? "WATERING",
        title: (z.title as string) ?? "",
        recurring: (z.recurring as string | null) ?? null,
        lastDoneAt: asDate(z.lastDoneAt),
        nextDueAt: asDate(z.nextDueAt),
        reason: (z.reason as string | null) ?? null,
        active: (z.active as boolean) ?? true,
      })),
      skipDuplicates: true,
    });
  }

  if (wpisy.length > 0) {
    await tx.plantJournalEntry.createMany({
      data: wpisy.map((w) => ({
        id: w.id as string,
        plantId: w.plantId as string,
        occurredAt: asDate(w.occurredAt) ?? new Date(),
        text: (w.text as string | null) ?? null,
        photoUrl: (w.photoUrl as string | null) ?? null,
      })),
      skipDuplicates: true,
    });
  }
  if (pomiary.length > 0) {
    await tx.plantMeasurement.createMany({
      data: pomiary.map((m) => ({
        id: m.id as string,
        plantId: m.plantId as string,
        measuredAt: asDate(m.measuredAt) ?? new Date(),
        kind: (m.kind as string) ?? "OTHER",
        value: (m.value as number) ?? 0,
        unit: (m.unit as string) ?? "",
        source: (m.source as string) ?? "manual",
        note: (m.note as string | null) ?? null,
      })),
      skipDuplicates: true,
    });
  }
  if (zdrowie.length > 0) {
    await tx.plantHealthEvent.createMany({
      data: zdrowie.map((z) => ({
        id: z.id as string,
        plantId: z.plantId as string,
        occurredAt: asDate(z.occurredAt) ?? new Date(),
        source: (z.source as string) ?? "manual",
        symptom: (z.symptom as string | null) ?? null,
        diagnosis: (z.diagnosis as string | null) ?? null,
        confidence: (z.confidence as string | null) ?? null,
        recommendationJson: (z.recommendationJson as string | null) ?? null,
        photoUrl: (z.photoUrl as string | null) ?? null,
        resolvedAt: asDate(z.resolvedAt),
        outcome: (z.outcome as string | null) ?? null,
      })),
      skipDuplicates: true,
    });
  }
}

/**
 * 113 — PRZYWRÓCENIE Z MODUŁU ROŚLINY.
 *
 * Migawka niesie `rodzaj`, bo kosz przyjmuje z tego modułu **dwa różne byty**: przestrzeń (razem
 * z jej miejscami i roślinami) albo pojedynczą roślinę. Identyfikatory z migawki odtwarzamy
 * **jawnie** — zdarzenia opieki przeżyły usunięcie (`SET NULL`), więc roślina wracająca z tym
 * samym `id` może odzyskać historię; nowe `id` skazywałoby ją na pustą oś czasu.
 */
async function restoreRosliny(d: Record<string, unknown>): Promise<void> {
  const rodzaj = d.rodzaj as string;

  if (rodzaj === "plantSpace") {
    const space = d.space as Record<string, unknown> | undefined;
    if (!space?.id) throw new Error("Uszkodzona migawka przestrzeni roślinnej");
    const miejsca = (space.places as Record<string, unknown>[]) ?? [];
    const rosliny = (space.plants as Record<string, unknown>[]) ?? [];

    await prisma.$transaction(async (tx) => {
      await tx.plantSpace.createMany({
        data: [
          {
            id: space.id as string,
            workspaceId: space.workspaceId as string,
            name: (space.name as string) ?? "Przywrócona przestrzeń",
            kind: (space.kind as string) ?? "home",
            weatherLocationId: (space.weatherLocationId as string | null) ?? null,
            notes: (space.notes as string | null) ?? null,
          },
        ],
        skipDuplicates: true,
      });
      if (miejsca.length > 0) {
        await tx.plantPlace.createMany({
          data: miejsca.map((m) => ({
            id: m.id as string,
            spaceId: m.spaceId as string,
            name: (m.name as string) ?? "",
            kind: (m.kind as string) ?? "windowsill",
            sun: (m.sun as string) ?? "unknown",
            soil: (m.soil as string | null) ?? null,
            areaValue: (m.areaValue as number | null) ?? null,
            areaUnit: (m.areaUnit as string | null) ?? null,
            notes: (m.notes as string | null) ?? null,
          })),
          skipDuplicates: true,
        });
      }
      if (rosliny.length > 0) {
        // Rodzic (`parentId`) świadomie NIE wraca: roślina-matka mogła nie należeć do tej
        // przestrzeni i wtedy klucz obcy odrzuciłby cały zapis.
        await tx.plant.createMany({
          data: rosliny.map((r) => wierszRoslinyZMigawki(r, (r.placeId as string | null) ?? null)),
          skipDuplicates: true,
        });
      }

      // Zadania opieki i zdarzenia. **Zdarzenia są tu ważniejsze niż zadania**: to w nich siedzi
      // ewidencja zabiegów środkami ochrony roślin, czyli dokumentacja, której `retention.ts` nie
      // pozwala usuwać nawet automatowi.
      const zadania = (space.careTasks as Record<string, unknown>[]) ?? [];
      const zdarzenia = (space.careEvents as Record<string, unknown>[]) ?? [];
      const idRoslin = new Set(rosliny.map((r) => r.id as string));
      const idMiejsc = new Set(miejsca.map((m) => m.id as string));
      /** Wskazanie wraca tylko wtedy, gdy cel też wrócił — inaczej klucz obcy odrzuciłby cały zapis. */
      const jesli = (zbior: Set<string>, id: unknown) =>
        typeof id === "string" && zbior.has(id) ? id : null;

      if (zadania.length > 0) {
        await tx.plantCareTask.createMany({
          data: zadania.map((z) => ({
            id: z.id as string,
            spaceId: z.spaceId as string,
            plantId: jesli(idRoslin, z.plantId),
            placeId: jesli(idMiejsc, z.placeId),
            kind: (z.kind as string) ?? "WATERING",
            title: (z.title as string) ?? "",
            recurring: (z.recurring as string | null) ?? null,
            lastDoneAt: asDate(z.lastDoneAt),
            nextDueAt: asDate(z.nextDueAt),
            reason: (z.reason as string | null) ?? null,
            active: (z.active as boolean) ?? true,
          })),
          skipDuplicates: true,
        });
      }
      if (zdarzenia.length > 0) {
        const idZadan = new Set(zadania.map((z) => z.id as string));
        await tx.plantCareEvent.createMany({
          data: zdarzenia.map((z) => ({
            id: z.id as string,
            spaceId: z.spaceId as string,
            plantId: jesli(idRoslin, z.plantId),
            placeId: jesli(idMiejsc, z.placeId),
            taskId: jesli(idZadan, z.taskId),
            kind: (z.kind as string) ?? "WATERING",
            occurredAt: asDate(z.occurredAt) ?? new Date(),
            outcome: (z.outcome as string) ?? "DONE",
            note: (z.note as string | null) ?? null,
            productName: (z.productName as string | null) ?? null,
            permitNumber: (z.permitNumber as string | null) ?? null,
            applicationKind: (z.applicationKind as string | null) ?? null,
            doseValue: (z.doseValue as number | null) ?? null,
            doseUnit: (z.doseUnit as string | null) ?? null,
            areaValue: (z.areaValue as number | null) ?? null,
            areaUnit: (z.areaUnit as string | null) ?? null,
            locationText: (z.locationText as string | null) ?? null,
            operator: (z.operator as string | null) ?? null,
            conditions: (z.conditions as string | null) ?? null,
            withdrawalDays: (z.withdrawalDays as number | null) ?? null,
            quantity: (z.quantity as number | null) ?? null,
            quantityUnit: (z.quantityUnit as string | null) ?? null,
            pantryItemId: (z.pantryItemId as string | null) ?? null,
          })),
          skipDuplicates: true,
        });
      }

      for (const r of rosliny) await przywrocDzieciRosliny(tx, r);
    });
    return;
  }

  if (rodzaj === "plant") {
    const p = d.plant as Record<string, unknown> | undefined;
    if (!p?.id) throw new Error("Uszkodzona migawka rośliny");
    // Przestrzeń mogła zniknąć razem z rośliną (kaskada) — wtedy przywrócenie jest bezprzedmiotowe
    // i mówimy o tym wprost, zamiast wywalać się kluczem obcym.
    const przestrzen = await prisma.plantSpace.findUnique({
      where: { id: p.spaceId as string },
      select: { id: true },
    });
    if (!przestrzen) throw new Error("Przestrzeń tej rośliny już nie istnieje — przywróć najpierw przestrzeń");

    const miejsce = p.placeId
      ? await prisma.plantPlace.findUnique({ where: { id: p.placeId as string }, select: { id: true } })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.plant.createMany({
        // Miejsce mogło zostać usunięte osobno — wtedy roślina wraca bez miejsca zamiast nie wracać
        // wcale.
        data: [wierszRoslinyZMigawki(p, miejsce?.id ?? null)],
        skipDuplicates: true,
      });
      await przywrocDzieciRosliny(tx, p);

      // Zdarzenia opieki przeżyły usunięcie z `plantId = NULL` (SET NULL) — migawka niesie
      // identyfikatory, więc przypinamy historię jawnie; warunek `plantId: null` pilnuje,
      // żeby nie ukraść zdarzenia, które ktoś w międzyczasie przypiął gdzie indziej.
      const idZdarzen = (d.careEventIds as string[] | undefined) ?? [];
      if (idZdarzen.length > 0) {
        await tx.plantCareEvent.updateMany({
          where: { id: { in: idZdarzen }, plantId: null },
          data: { plantId: p.id as string },
        });
      }
    });
    return;
  }

  throw new Error("Nieznany rodzaj migawki modułu Rośliny");
}
