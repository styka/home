"use server";

import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { getAccessContext } from "@/platform/sharing/cache";
import { loadResourceCatalog } from "@/lib/sharingResources";

/**
 * 067 (zadanie 14, część odczytowa) — „UDOSTĘPNIONE MI" I „CO UDOSTĘPNIŁEM".
 *
 * Rozdz. 8.7 mówi o tym widoku rzecz, która jest sednem całej Fazy 2:
 * *„Widok »Udostępnione mi« jest możliwy tylko dzięki jednolitemu modelowi — przy pięciu
 * mechanizmach wymagałby pięciu zapytań i pięciu formatów."*
 *
 * To jest **wypłata** za 051–066. Przed tą fazą pytanie „co mi udostępniono?" wymagałoby zapytania
 * do `TaskProjectMember`, `TaskShare`, `PetShare`, sprawdzenia `ownerTeamId` w kilkunastu tabelach
 * i sklejenia pięciu różnych słowników ról. Teraz to **jedno zapytanie do jednej tabeli**.
 *
 * **Nazwę zasobu bierzemy z deklaracji modułu**, nie z mapy w tym pliku. Platforma nie zna modułów
 * (C-36), a warstwa kompozycji zna wszystkie — więc etykieta („Projekt zadań", „Zwierzę") pochodzi
 * z `label` w `sharing.ts` danego modułu. Mapa tutaj byłaby szóstym miejscem, w którym trzeba
 * pamiętać o nowym typie zasobu.
 */

export interface SharedGrantRow {
  id: string;
  resourceType: string;
  /** Etykieta typu z deklaracji modułu — „Projekt zadań", „Zwierzę". */
  resourceLabel: string;
  resourceId: string;
  role: string;
  /** `user` = konkretna osoba, `workspace` = cała przestrzeń (zespół). */
  subjectType: string;
  /** Nazwa obdarowanego: e-mail osoby albo nazwa przestrzeni. */
  subjectLabel: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** Etykiety typów zasobów z deklaracji modułów; nieznany typ zostaje sobą, a nie „(nieznany)". */
async function etykietyTypow(): Promise<Record<string, string>> {
  const katalog = await loadResourceCatalog();
  return Object.fromEntries(Object.entries(katalog).map(([typ, d]) => [typ, d.label]));
}

async function nazwyPodmiotow(
  nadania: { subjectType: string; subjectId: string | null }[],
): Promise<Record<string, string>> {
  const userIds = nadania.filter((n) => n.subjectType === "user" && n.subjectId).map((n) => n.subjectId!);
  const wsIds = nadania.filter((n) => n.subjectType === "workspace" && n.subjectId).map((n) => n.subjectId!);
  const [users, spaces] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } })
      : [],
    wsIds.length
      ? prisma.workspace.findMany({ where: { id: { in: wsIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const out: Record<string, string> = {};
  for (const u of users) out[u.id] = u.name ?? u.email ?? "(bez nazwy)";
  for (const w of spaces) out[w.id] = w.name;
  return out;
}

/**
 * Zasoby udostępnione **mnie** — przez nadanie dla mnie albo dla przestrzeni, której jestem
 * członkiem. Jedno zapytanie, wszystkie moduły.
 */
export async function getSharedWithMe(): Promise<SharedGrantRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const ctx = await getAccessContext(userId);

  const teraz = new Date();
  const nadania = await prisma.resourceGrant.findMany({
    where: {
      AND: [
        {
          OR: [
            { subjectType: "user", subjectId: userId },
            ...(ctx.workspaceIds.length
              ? [{ subjectType: "workspace", subjectId: { in: ctx.workspaceIds } }]
              : []),
          ],
        },
        // Nadanie, któremu minął termin, nie daje dostępu — więc nie ma go też na liście.
        // Pokazanie go byłoby obietnicą, której `requireAccess` nie dotrzyma.
        { OR: [{ expiresAt: null }, { expiresAt: { gt: teraz } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const [etykiety, podmioty] = await Promise.all([etykietyTypow(), nazwyPodmiotow(nadania)]);
  return nadania.map((n) => ({
    id: n.id,
    resourceType: n.resourceType,
    resourceLabel: etykiety[n.resourceType] ?? n.resourceType,
    resourceId: n.resourceId,
    role: n.role,
    subjectType: n.subjectType,
    subjectLabel: n.subjectId ? (podmioty[n.subjectId] ?? null) : null,
    expiresAt: n.expiresAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
}

/**
 * Zasoby, które udostępniłem **ja** — nadania w moich przestrzeniach, wystawione komuś innemu.
 *
 * Filtrujemy po przestrzeni zasobu, a nie po `createdById`: nadania z migracji 0229/0230 mają tam
 * właściciela zasobu, ale nadanie wystawione kiedyś przez współpracownika też dotyczy **mojego**
 * zasobu i powinno tu być widoczne. Pytanie brzmi „co z moich rzeczy jest udostępnione", nie
 * „co ja osobiście kliknąłem".
 */
export async function getSharedByMe(): Promise<SharedGrantRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const ctx = await getAccessContext(userId);
  if (!ctx.personalWorkspaceId && ctx.workspaceIds.length === 0) return [];

  const nadania = await prisma.resourceGrant.findMany({
    where: {
      workspaceId: { in: ctx.workspaceIds },
      // Nadanie dla mnie samego nie jest „udostępnieniem" — to mój własny dostęp.
      NOT: { subjectType: "user", subjectId: userId },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const [etykiety, podmioty] = await Promise.all([etykietyTypow(), nazwyPodmiotow(nadania)]);
  return nadania.map((n) => ({
    id: n.id,
    resourceType: n.resourceType,
    resourceLabel: etykiety[n.resourceType] ?? n.resourceType,
    resourceId: n.resourceId,
    role: n.role,
    subjectType: n.subjectType,
    subjectLabel: n.subjectId ? (podmioty[n.subjectId] ?? null) : null,
    expiresAt: n.expiresAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
}
