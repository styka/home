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
 * 079: `ownedWhere` / `ownedOr` (wersje SYNCHRONICZNE, po `ownerId`/`ownerTeamId`) ZOSTAŁY USUNIĘTE
 * razem z kolumnami (migracja 0244). Nie miały już ani jednego konsumenta poza własnymi testami —
 * zakres list liczy `ownedOrAsync` poniżej. Zostawienie ich byłoby pułapką: funkcja budująca filtr
 * po nieistniejących kolumnach kompiluje się (zwraca `Record<string, unknown>`) i wywala się dopiero
 * w czasie działania, przy pierwszym zapytaniu.
 *
 * Zakres dla tabel SŁOWNIKOWYCH (pięć wyjątków z `workspace-nullable.json`) to osobna sprawa i ma
 * własny helper: `ownedOrSystemWhere` niżej. Tam `ownerId` żyje dalej.
 */

/**
 * 058 (etap 3B krok 2) — ZAKRES IDZIE PO PRZESTRZENIACH.
 *
 * To jest realizacja zdania z rozdz. 8.2: *„Dziś każde zapytanie musi obsłużyć oba przypadki
 * (`OR: [{ownerId}, {ownerTeamId: {in: teamIds}}]`). Po zmianie: `where: { workspaceId: { in:
 * mySpaces } }`."* Dzięki 057 zmiana dotyczy **tego jednego miejsca**, a nie 79.
 *
 * **079: została JEDNA gałąź** — `workspaceId in mojePrzestrzenie`. Obejmuje przestrzeń osobistą
 * **i** zespołowe, bo jedno i drugie to po prostu przestrzeń, której jestem członkiem. Dwie gałęzie
 * przejściowe (po `ownerId` i po `ownerTeamId`, dla rekordów bez przestrzeni) zniknęły razem
 * z kolumnami w migracji 0244 — a wcześniej, w 075, razem z możliwością istnienia takiego rekordu.
 *
 * Zakres przestrzeni bierzemy z kontekstu dostępu, liczonego **raz na żądanie** (cache z 052) —
 * dlatego funkcja jest asynchroniczna, a liczba zapytań nie rośnie.
 */
export async function ownedOrAsync(userId: string): Promise<Record<string, unknown>[]> {
  const { getAccessContext } = await import("@/platform/sharing/cache");
  const ctx = await getAccessContext(userId);
  // Rekordy SYSTEMOWE (pięć tabel z `workspace-nullable.json`) nigdy tędy nie chodziły: mają
  // `ownerId IS NULL`, więc nie pasowały nawet do dawnych gałęzi przejściowych. Ich drogą jest
  // `ownedOrSystemWhere`, nie ta funkcja.
  //
  // 079 (U-3): GAŁĄŹ `{ ownerId: userId }` ZNIKŁA razem z kolumną (migracja 0244). Była
  // gwarancją „właściciel nigdy nie traci swojego rekordu" na wypadek zasobu poza jego
  // przestrzeniami; po usunięciu kolumny nie ma z czego jej zbudować, a jej rolę przejęło
  // `getAccessContext`, które przestrzeń OSOBISTĄ czyta po `Workspace.personalUserId`, a nie po
  // członkostwie (079, krok 1). Zostawienie jej tutaj nie było opcją: dla nieistniejącej kolumny
  // Prisma odrzuca filtr w czasie DZIAŁANIA, więc wywróciłaby każde zapytanie zakresowe.
  //
  // Pusty wynik jest możliwy tylko dla konta bez ANI JEDNEJ przestrzeni — czyli takiego, które nie
  // ma też żadnych rekordów. `OR: []` w Prismie nie pasuje do niczego, i to jest tu poprawne.
  const gałęzie: Record<string, unknown>[] = [];
  if (ctx.workspaceIds.length > 0) gałęzie.push({ workspaceId: { in: ctx.workspaceIds } });
  return gałęzie;
}

/** Jak wyżej, ale gotowy `where`. */
export async function ownedWhereAsync(userId: string) {
  return { OR: await ownedOrAsync(userId) };
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

/**
 * 079 (zadanie 11, etap 4) — `getAccessibleTeamIds` WYRAŻONE PRZESTRZENIAMI.
 *
 * Guardy pojedynczego rekordu w dziewiętnastu modułach mają dziś kształt
 * `rec.ownerId === ja || teamIdsDostepneDlaModulu.includes(rec.ownerTeamId)`. Etap 4 zabiera obie
 * kolumny, więc trzeba przełożyć **cały** ten warunek, a nie tylko jego pierwszą połowę.
 *
 * **Dlaczego nie `ownedOrAsync` / `ctx.workspaceIds`.** To byłoby POSZERZENIE i to takie, którego
 * dziś nie widać: `ctx.workspaceIds` to wszystkie moje przestrzenie, a ten warunek jest węższy —
 * pomija zespoły, w których „domownik" ma odebrany dostęp do tego konkretnego modułu
 * (`TeamMember.moduleAccess`, Z-194). U kogoś bez ograniczeń oba zbiory są identyczne, więc
 * podmiana przeszłaby bez śladu i zaszkodziła dopiero pierwszemu ograniczonemu kontu.
 *
 * Zwracana lista to **przestrzeń osobista + przestrzenie zespołów dostępnych dla tego modułu** —
 * przekład jeden do jednego, oparty na lustrze z zadania 9. Równoważność sprawdza
 * `accessibleWorkspaceIds.integration.test.ts` porównaniem ZBIORÓW na prawdziwych danych,
 * z przypadkiem różnicującym (ograniczony moduł), a nie powtórzeniem tej samej arytmetyki.
 */
export async function getAccessibleWorkspaceIds(userId: string, moduleId: string): Promise<string[]> {
  const teamIds = await getAccessibleTeamIds(userId, moduleId);
  const przestrzenie = await prisma.workspace.findMany({
    where: {
      OR: [
        { personalUserId: userId },
        ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
      ],
    },
    select: { id: true },
  });
  return przestrzenie.map((w) => w.id);
}
