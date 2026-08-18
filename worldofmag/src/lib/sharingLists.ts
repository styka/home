import { prisma } from "@/platform/db/prisma";
import { getAccessContext } from "@/platform/sharing/cache";
import { loadResourceCatalog } from "@/lib/sharingResources";
import { SUFIT_LISTY } from "@/platform/pagination";

/**
 * 084 (zadanie 28) — RDZEŃ list nadań, bez sesji.
 *
 * Wydzielony z `actions/sharing.ts` z tego samego powodu, dla którego `collectCalendarEvents` stoi
 * obok `getCalendarEvents`: **pomiar N+1 nie ma jak wywołać Server Action** (potrzebowałby sesji
 * i cookies). Bez tego rozdzielenia powstałaby pokusa zmierzenia „czegoś podobnego” napisanego
 * w teście — czyli zmierzenia kodu, którego użytkownik nigdy nie uruchamia.
 *
 * Zawartość jest przeniesiona bez zmian; akcje dokładają wyłącznie odczyt sesji. Uzasadnienia
 * decyzji (jedno zapytanie do jednej tabeli, etykiety z deklaracji modułów, filtr po przestrzeni
 * zamiast po `createdById`) zostały przy akcjach, bo tam się ich szuka.
 */

export interface SharedGrantRow {
  id: string;
  resourceType: string;
  /** Etykieta typu z deklaracji modułu — „Projekt zadań”, „Zwierzę”. */
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

/** Etykiety typów zasobów z deklaracji modułów; nieznany typ zostaje sobą, a nie „(nieznany)”. */
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
      ? prisma.user.findMany({ take: SUFIT_LISTY, where: { id: { in: userIds } }, select: { id: true, email: true, name: true } })
      : [],
    wsIds.length
      ? prisma.workspace.findMany({ take: SUFIT_LISTY, where: { id: { in: wsIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const out: Record<string, string> = {};
  for (const u of users) out[u.id] = u.name ?? u.email ?? "(bez nazwy)";
  for (const w of spaces) out[w.id] = w.name;
  return out;
}

type WierszNadania = {
  id: string;
  resourceType: string;
  resourceId: string;
  role: string;
  subjectType: string;
  subjectId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
};

function naWiersz(
  n: WierszNadania,
  etykiety: Record<string, string>,
  podmioty: Record<string, string>,
): SharedGrantRow {
  return {
    id: n.id,
    resourceType: n.resourceType,
    resourceLabel: etykiety[n.resourceType] ?? n.resourceType,
    resourceId: n.resourceId,
    role: n.role,
    subjectType: n.subjectType,
    subjectLabel: n.subjectId ? (podmioty[n.subjectId] ?? null) : null,
    expiresAt: n.expiresAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function zbierzUdostepnioneMnie(userId: string): Promise<SharedGrantRow[]> {
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
  return nadania.map((n) => naWiersz(n, etykiety, podmioty));
}

export async function zbierzUdostepnionePrzezeMnie(userId: string): Promise<SharedGrantRow[]> {
  const ctx = await getAccessContext(userId);
  if (!ctx.personalWorkspaceId && ctx.workspaceIds.length === 0) return [];
  const nadania = await prisma.resourceGrant.findMany({
    where: {
      workspaceId: { in: ctx.workspaceIds },
      // Nadanie dla mnie samego nie jest „udostępnieniem” — to mój własny dostęp.
      NOT: { subjectType: "user", subjectId: userId },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const [etykiety, podmioty] = await Promise.all([etykietyTypow(), nazwyPodmiotow(nadania)]);
  return nadania.map((n) => naWiersz(n, etykiety, podmioty));
}
