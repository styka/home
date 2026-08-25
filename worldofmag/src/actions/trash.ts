"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { TRASH_RETENTION_DAYS } from "@/platform/trash/trash";
import { SUFIT_LISTY } from "@/platform/pagination";
import {
  przestrzenOsobista,
  przestrzenZespoluBezKontroliDostepu,
  filtrMoichRekordow,
} from "@/platform/workspaces/zapis";

export type TrashItemDTO = {
  id: string;
  module: string;
  entityId: string;
  title: string;
  deletedAt: string;
};

export async function getTrash(): Promise<{ items: TrashItemDTO[]; retentionDays: number }> {
  const user = await requireAuth();
  // Sprzątanie przeterminowanych przy każdym wejściu (free-tier: bez crona).
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);
  await prisma.trashItem.deleteMany({ where: { userId: user.id, deletedAt: { lt: cutoff } } });

  const rows = await prisma.trashItem.findMany({
    take: SUFIT_LISTY,
    where: { userId: user.id },
    orderBy: { deletedAt: "desc" },
  });
  return {
    items: rows.map((r) => ({
      id: r.id, module: r.module, entityId: r.entityId, title: r.title, deletedAt: r.deletedAt.toISOString(),
    })),
    retentionDays: TRASH_RETENTION_DAYS,
  };
}

export async function restoreTrashItem(id: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) throw new Error("Pozycja kosza nie istnieje");

  const data = JSON.parse(item.payload) as Record<string, unknown>;
  if (item.module === "notes") await restoreNote(data);
  else if (item.module === "tasks") await restoreTask(data);
  else if (item.module === "weather") await restoreWeatherIdea(data);
  else if (item.module === "youtube") await restoreYoutubeChannel(data);
  else throw new Error("Nieobsługiwany typ pozycji");

  await prisma.trashItem.delete({ where: { id } });
  revalidatePath("/trash");
  revalidatePath("/notes");
  revalidatePath("/tasks");
  revalidatePath("/pogoda/pomysly");
  revalidatePath("/youtube/kanaly");
}

export async function purgeTrashItem(id: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) return;
  await prisma.trashItem.delete({ where: { id } });
  revalidatePath("/trash");
}

export async function emptyTrash(): Promise<void> {
  const user = await requireAuth();
  await prisma.trashItem.deleteMany({ where: { userId: user.id } });
  revalidatePath("/trash");
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
 * przywrócić na swoje miejsce** — a kosz ma 30-dniową retencję, więc takich migawek będzie pełno.
 * Objaw byłby przy tym miły dla oka: przywracanie „działa", rekord wraca bez przestrzeni albo
 * z cudzą. Dlatego kolejność jest: najpierw przestrzeń z migawki, a gdy jej nie ma — wyprowadzenie
 * z kolumn własnościowych, dokładnie tak, jak robił to wyzwalacz 0236/0238.
 *
 * Funkcja zwraca też kolumny własnościowe, dopóki istnieją — z tego samego powodu, co
 * `wlasnoscDoZapisu`: żeby usunięcie kolumn było zmianą JEDNEGO ciała funkcji, a nie obchodzeniem
 * wszystkich restoratorów po kolei.
 */
async function przestrzenZMigawki(
  d: Record<string, unknown>
): Promise<{ workspaceId: string }> {
  const zMigawki = (d.workspaceId as string | null) ?? null;
  if (zMigawki) return { workspaceId: zMigawki };

  /**
   * Migawka sprzed 078 nie zna przestrzeni — ma tylko kolumny własnościowe, których w bazie już
   * nie ma. To jest jedyne miejsce w aplikacji, gdzie `ownerId`/`ownerTeamId` NADAL się czyta
   * i nadal musi: kosz przechowuje JSON utrwalony w chwili usunięcia, a jego schemat jest zamrożony
   * w tamtym momencie. Migawki z retencji sprzed etapu 4 (30 dni) muszą dać się przywrócić.
   * 079: funkcja zwraca już samo `{ workspaceId }`, bo tyle przyjmuje zapis.
   */
  const ownerId = (d.ownerId as string | null) ?? null;
  const ownerTeamId = (d.ownerTeamId as string | null) ?? null;
  const workspaceId = ownerTeamId
    ? await przestrzenZespoluBezKontroliDostepu(ownerTeamId)
    : await przestrzenOsobista(ownerId ?? (await requireAuth()).id);
  return { workspaceId };
}

/**
 * 079: wariant „dla tabel o `ownerId NOT NULL`" STRACIŁ PRZEDMIOT — takich tabel nie ma, bo nie ma
 * kolumny. Nazwa zostaje jako pojedyncze miejsce wywołania w restauratorze `WeatherIdea`; treść to
 * już zwykłe przekazanie dalej. Skasowanie jej byłoby zmianą w kilku restauratorach naraz, bez
 * żadnego zysku poza jedną linią mniej.
 */
async function przestrzenZMigawkiOsobista(
  d: Record<string, unknown>
): Promise<{ workspaceId: string }> {
  return przestrzenZMigawki(d);
}

async function restoreNote(d: Record<string, unknown>): Promise<void> {
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
      ...(await przestrzenZMigawki(d)),
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
 * 037: propozycja „co robić" z modułu Pogoda.
 *
 * Uwaga na `[ownerId, fingerprint]`: to klucz unikalny, więc jeśli po usunięciu użytkownik zdążył
 * ponownie zablokować lub obejrzeć propozycję o tej samej nazwie, wiersz już istnieje. Przywracamy
 * wtedy tylko treść, której nowy wiersz nie ma (szczegóły) — twarde `create` wywaliłoby się na
 * naruszeniu unikalności.
 */
/**
 * 102 (AC-18): przywrócenie obserwowanego kanału YouTube.
 *
 * Przywracamy sam kanał, nie jego filmy — te znikły kaskadą przy usunięciu i **dobiorą się same**
 * przy najbliższym odświeżeniu. Odtwarzanie ich z migawki dałoby setki wierszy sprzed tygodni,
 * czyli stan, którego użytkownik nie chce oglądać, a który i tak zostałby nadpisany.
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

async function restoreWeatherIdea(d: Record<string, unknown>): Promise<void> {
  const id = d.id as string;
  const ownerId = d.ownerId as string;
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
      ...(await przestrzenZMigawkiOsobista(d)),
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
