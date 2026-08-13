import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { canMemberAccessModule } from "@/lib/teams/memberAccess";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string; role?: string };
}

/** Czy zalogowany użytkownik ma dostęp do panelu administratora. */
export async function isAdminSession(): Promise<boolean> {
  return hasPermission(await auth(), PERMISSIONS.ADMIN);
}

/**
 * 057 (Faza 2, zadanie 11 / etap 3B krok 1) — WARUNEK „ZASOBY, KTÓRE WIDZĘ", W JEDNYM MIEJSCU.
 *
 * Do tej pory ten sam `OR` był wpisany ręcznie w **79 miejscach w 52 plikach**. Etap 3B ma go
 * zamienić na zakres po przestrzeniach (`workspaceId: { in: … }`, rozdz. 8.2) — a to da się zrobić
 * **jedną zmianą** tylko wtedy, gdy warunek istnieje w jednym miejscu. Ten helper niczego jeszcze
 * nie zmienia: zwraca **strukturalnie ten sam** obiekt, co kod, który zastępuje.
 *
 * **Dwa kształty, jedno znaczenie.** W repo występowały dwa warianty — bezwarunkowy
 * `{ ownerTeamId: { in: teamIds } }` i ostrożniejszy `...(teamIds.length > 0 ? [...] : [])`.
 * Są **równoważne**, bo `in: []` nie pasuje do żadnego wiersza; helper zwraca wariant krótszy,
 * a test `ownershipScope.test.ts` tę równoważność sprawdza, zamiast ją zakładać.
 *
 * **To NIE jest helper dla rekordów słownikowych** — te widać także jako systemowe
 * (`ownerId = null`) i mają własny `ownedOrSystemWhere` niżej. Użycie tego helpera tam odebrałoby
 * dostęp do rekordów systemowych; użycie tamtego tutaj — dodałoby dostęp, którego nie było.
 *
 * @param userId właściciel osobisty
 * @param teamIds zespoły użytkownika (`getUserTeamIds`); pusta lista = brak gałęzi zespołowej
 */
export function ownedWhere(userId: string, teamIds: string[]) {
  return { OR: ownedOr(userId, teamIds) };
}

/**
 * 058 (etap 3B krok 2) — ZAKRES IDZIE PO PRZESTRZENIACH.
 *
 * To jest realizacja zdania z rozdz. 8.2: *„Dziś każde zapytanie musi obsłużyć oba przypadki
 * (`OR: [{ownerId}, {ownerTeamId: {in: teamIds}}]`). Po zmianie: `where: { workspaceId: { in:
 * mySpaces } }`."* Dzięki 057 zmiana dotyczy **tego jednego miejsca**, a nie 79.
 *
 * **Trzy gałęzie, każda z powodem:**
 * 1. `workspaceId in mojePrzestrzenie` — właściwa reguła docelowa. Obejmuje przestrzeń osobistą
 *    **i** zespołowe, bo jedno i drugie to po prostu przestrzeń, której jestem członkiem.
 * 2. `ownerId = ja` **przy pustej przestrzeni** — rekord bez przestrzeni (sierota po backfillu
 *    0227) musi pozostać widoczny dla właściciela. Bez tego zniknąłby użytkownikowi z listy, a to
 *    zmiana widoczna, której spec nie zamawia.
 * 3. `ownerTeamId in mojeZespoły` **przy pustej przestrzeni** — to samo dla sierot zespołowych.
 *
 * Gałęzie 2 i 3 są **przejściowe** i znikają w etapie 4 razem z kolumnami. Warunek
 * `workspaceId: null` jest przy nich istotny: bez niego stara reguła działałaby dalej **obok**
 * nowej i przełączenie niczego by nie dowodziło — zbiory wyszłyby równe niezależnie od tego, czy
 * gałąź pierwsza w ogóle działa (lekcja z 056: „zielony test, który dowodził, że nowy kod się nie
 * uruchomił").
 *
 * Zakres przestrzeni bierzemy z kontekstu dostępu, liczonego **raz na żądanie** (cache z 052) —
 * dlatego funkcja jest asynchroniczna, a liczba zapytań nie rośnie.
 */
export async function ownedOrAsync(userId: string): Promise<Record<string, unknown>[]> {
  const { getAccessContext } = await import("@/platform/sharing/cache");
  const ctx = await getAccessContext(userId);
  const gałęzie: Record<string, unknown>[] = [];
  if (ctx.workspaceIds.length > 0) gałęzie.push({ workspaceId: { in: ctx.workspaceIds } });
  gałęzie.push({ workspaceId: null, ownerId: userId });
  if (ctx.teamIds.length > 0) {
    gałęzie.push({ workspaceId: null, ownerTeamId: { in: ctx.teamIds } });
  }
  return gałęzie;
}

/** Jak wyżej, ale gotowy `where`. */
export async function ownedWhereAsync(userId: string) {
  return { OR: await ownedOrAsync(userId) };
}

/**
 * Same alternatywy, bez opakowania w `OR` — dla zapytań, które wstawiają je do własnego `AND`
 * albo dokładają trzecią gałąź (np. przypisanie do zasobu). Istnieje, bo bez tego takie miejsca
 * musiałyby rozpakowywać `ownedWhere(...).OR` i bramka nie miałaby czego pilnować.
 */
export function ownedOr(userId: string, teamIds: string[]) {
  return teamIds.length > 0
    ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }]
    : [{ ownerId: userId }];
}

/**
 * 034: warunek widoczności rekordu SŁOWNIKOWEGO z właścicielem (grupy notatek, etykiety,
 * podpowiedzi zakupowe). Widać: swoje, zespołowe oraz SYSTEMOWE (bez właściciela — wspólne
 * dla wszystkich kont, tak jak kategorie systemowe). C-21.
 */
export function ownedOrSystemWhere(userId: string, teamIds: string[], withTeam = true) {
  const or: Record<string, unknown>[] = [{ ownerId: userId }];
  if (withTeam && teamIds.length > 0) or.push({ ownerTeamId: { in: teamIds } });
  or.push(withTeam ? { ownerId: null, ownerTeamId: null } : { ownerId: null });
  return { OR: or };
}

/**
 * 034: guard edycji/kasowania rekordu słownikowego. Rekord systemowy (bez właściciela) jest
 * czytelny dla wszystkich, ale zmieniać go może wyłącznie administrator — inaczej jeden użytkownik
 * przemianowałby wspólną etykietę wszystkim pozostałym.
 */
export async function assertDictionaryAccess(
  record: { ownerId?: string | null; ownerTeamId?: string | null } | null,
  userId: string,
  label: string
): Promise<void> {
  if (!record) throw new Error(`${label} nie istnieje`);
  if (record.ownerId === userId) return;
  if (record.ownerTeamId) {
    const teamIds = await getUserTeamIds(userId);
    if (teamIds.includes(record.ownerTeamId)) return;
  }
  if (!record.ownerId && !record.ownerTeamId && (await isAdminSession())) return;
  throw new Error(`Brak dostępu: ${label}`);
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
  const rows = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  return rows.map((r) => r.teamId);
}

/**
 * Z-194 (T-12): warianty `getUserTeamIds` z egzekwowaniem granularnych ról rodzic/dziecko.
 * Zwraca tylko te zespoły, w których użytkownik (wg roli + `moduleAccess`) ma dostęp do
 * współdzielonych zasobów danego modułu. „Rodzic" (OWNER/ADMIN) i „dziecko" bez ograniczeń
 * widzą wszystko — więc dla typowego użytkownika wynik = `getUserTeamIds`.
 * Seam do stopniowego wpięcia w odczyty modułów team-aware (rollout po deployu).
 */
export async function getAccessibleTeamIds(userId: string, moduleId: string): Promise<string[]> {
  const rows = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true, role: true, moduleAccess: true },
  });
  return rows
    .filter((r) => canMemberAccessModule(r, moduleId))
    .map((r) => r.teamId);
}
