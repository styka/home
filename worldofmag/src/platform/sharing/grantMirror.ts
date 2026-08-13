import { prisma } from "@/platform/db/prisma";
import { resourceRoleFromLegacy, type ResourceRole } from "@/platform/workspaces/types";

/**
 * 059 (zadanie 12, etap 1) — LUSTRO NADAŃ.
 *
 * Przez okres przejściowy ta sama informacja („kto ma dostęp do tego zasobu") mieszka w dwóch
 * miejscach: w dawnych tabelach (`TaskProjectMember`, `TaskShare`) i w `ResourceGrant`. Tabele są
 * źródłem prawdy, nadania — lustrem. Dokładnie ten sam układ, co przestrzenie wobec zespołów
 * w 051, i z tym samym zagrożeniem: **rozjazd nie objawia się niczym**, bo nadań nikt jeszcze nie
 * czyta. Wyszedłby dopiero w etapie 2, czyli najpóźniej i najdrożej.
 *
 * Dlatego kto mutuje członkostwo albo udostępnienie, **uzgadnia nadanie** — wymusza to
 * `npm run check:grant-mirror`.
 *
 * **Czego to lustro NIE robi:** nie wymyśla przestrzeni. `ResourceGrant.workspaceId` jest wymagane,
 * a zasób bez przestrzeni (sierota po 0227) jej nie ma — wtedy nadanie po prostu nie powstaje,
 * tak samo jak w migracji 0229. Zapis użytkownika ma się udać; kompletność lustra jest tu mniej
 * ważna niż to, żeby udostępnianie działało. Test to ZLICZA, zamiast przemilczeć.
 */

/** Przestrzeń, w której żyje zadanie: z projektu, a dla zadania luzem — osobista twórcy. */
async function przestrzenZadania(taskId: string): Promise<string | null> {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { createdById: true, project: { select: { workspaceId: true } } },
  });
  if (!t) return null;
  if (t.project?.workspaceId) return t.project.workspaceId;
  if (!t.createdById) return null;
  const w = await prisma.workspace.findUnique({
    where: { personalUserId: t.createdById },
    select: { id: true },
  });
  return w?.id ?? null;
}

async function przestrzenProjektu(projectId: string): Promise<string | null> {
  const p = await prisma.taskProject.findUnique({
    where: { id: projectId },
    select: { workspaceId: true, ownerId: true },
  });
  return p?.workspaceId ?? null;
}

interface Nadanie {
  resourceType: string;
  resourceId: string;
  subjectType: "user" | "workspace";
  subjectId: string;
  role: ResourceRole;
  workspaceId: string;
  createdById: string;
}

async function zapisz(n: Nadanie): Promise<void> {
  await prisma.resourceGrant.upsert({
    where: {
      resourceType_resourceId_subjectType_subjectId: {
        resourceType: n.resourceType,
        resourceId: n.resourceId,
        subjectType: n.subjectType,
        subjectId: n.subjectId,
      },
    },
    create: { ...n, inherited: false },
    // Zmiana roli w źródle ma zmienić rolę w lustrze — inaczej degradacja z EDITOR na VIEWER
    // zostawiłaby stare, wyższe nadanie.
    update: { role: n.role, workspaceId: n.workspaceId },
  });
}

async function usun(resourceType: string, resourceId: string, subjectType: string, subjectId: string) {
  await prisma.resourceGrant
    .delete({
      where: {
        resourceType_resourceId_subjectType_subjectId: {
          resourceType,
          resourceId,
          subjectType,
          subjectId,
        },
      },
    })
    // Brak wiersza to nie błąd: nadanie mogło nie powstać (zasób bez przestrzeni).
    .catch(() => undefined);
}

/** Członkostwo w projekcie powstało albo zmieniło rolę. */
export async function mirrorProjectMember(
  projectId: string,
  userId: string,
  legacyRole: string,
  createdById: string,
): Promise<void> {
  const role = resourceRoleFromLegacy(legacyRole);
  const workspaceId = await przestrzenProjektu(projectId);
  if (!role || !workspaceId) return;
  await zapisz({
    resourceType: "tasks.project",
    resourceId: projectId,
    subjectType: "user",
    subjectId: userId,
    role,
    workspaceId,
    createdById,
  });
}

/** Członkostwo zniknęło — nadanie musi zniknąć razem z nim (nadanie bez źródła to cichy dostęp). */
export async function unmirrorProjectMember(projectId: string, userId: string): Promise<void> {
  await usun("tasks.project", projectId, "user", userId);
}

/** Udostępnienie zadania osobie albo zespołowi. `teamId` trafia na PRZESTRZEŃ tego zespołu. */
export async function mirrorTaskShare(
  taskId: string,
  cel: { userId?: string | null; teamId?: string | null },
  legacyRole: string,
  createdById: string,
): Promise<void> {
  const role = resourceRoleFromLegacy(legacyRole);
  const workspaceId = await przestrzenZadania(taskId);
  if (!role || !workspaceId) return;

  if (cel.userId) {
    await zapisz({
      resourceType: "tasks.task",
      resourceId: taskId,
      subjectType: "user",
      subjectId: cel.userId,
      role,
      workspaceId,
      createdById,
    });
    return;
  }
  if (cel.teamId) {
    const tw = await prisma.workspace.findUnique({
      where: { teamId: cel.teamId },
      select: { id: true },
    });
    if (!tw) return;
    await zapisz({
      resourceType: "tasks.task",
      resourceId: taskId,
      subjectType: "workspace",
      subjectId: tw.id,
      role,
      workspaceId,
      createdById,
    });
  }
}

/** Udostępnienie zniknęło. */
export async function unmirrorTaskShare(
  taskId: string,
  cel: { userId?: string | null; teamId?: string | null },
): Promise<void> {
  if (cel.userId) {
    await usun("tasks.task", taskId, "user", cel.userId);
    return;
  }
  if (cel.teamId) {
    const tw = await prisma.workspace.findUnique({
      where: { teamId: cel.teamId },
      select: { id: true },
    });
    if (tw) await usun("tasks.task", taskId, "workspace", tw.id);
  }
}
