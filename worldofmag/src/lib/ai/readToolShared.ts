import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { matchNamedRef, unresolvedRefMessage, type NamedCandidate, type RefResolution } from "@/platform/ai/refResolve";

/**
 * 049: helpery narzędzi ODCZYTU, wspólne dla wszystkich modułów.
 *
 * Zostają w warstwie kompozycji, a nie w platformie ani w module: sięgają wprost do Prismy
 * (bez importu żadnego kontraktu), a używa ich kilkanaście modułów naraz — po regule
 * przynależności („lista konsumentów, nie nazwa") nie należą do żadnego z nich.
 */

export const HARD_MAX = 60;
// 030: domyślny limit list 40→25 — tnie tokeny wyników; model zawsze może podać jawny limit.
export function clampLimit(n: unknown, def = 25): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : def;
  return Math.max(1, Math.min(HARD_MAX, Math.floor(v)));
}

export function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function accessibleProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

/**
 * 032: rozwiązuje referencję albo RZUCA błędem, który mówi agentowi, co się stało. Kluczowe, że
 * rozróżniamy „nie znalazłem” od „pasuje kilka” — na tym stoi zdolność agenta do dopytania zamiast
 * powtarzania tego samego odczytu (albo, co gorsza, twierdzenia „nie ma nic”).
 *
 * Objęte tym mechanizmem toole (audyt argumentów kończących się na `Id`): `list_tasks` (projectId,
 * przez `resolveProjectRef`), `get_task` (taskId), `list_items` (listId), `get_note` (noteId),
 * `get_recipe` (recipeId). Pozostałe argumenty „identyfikatorowe” w read-toolach albo już są nazwami
 * (`args.warehouse`, `args.petName`, `args.deckName` — dopasowanie po `contains`), albo nie istnieją.
 *
 * `label` to polska nazwa rodzaju zasobu w dopełniaczu, np. „listy zakupów”, „notatki”.
 */
export async function resolveRefOrThrow(
  ref: string,
  label: string,
  load: () => Promise<NamedCandidate[]>
): Promise<string> {
  const candidates = await load();
  const res = matchNamedRef(ref, candidates);
  if ("id" in res) return res.id;
  throw new Error(unresolvedRefMessage(res, label));
}

/**
 * 032: wariant dla getterów pojedynczego rekordu. Najpierw TANI strzał po identyfikatorze — dopiero
 * gdy nie trafi, ładujemy listę nazw i rozwiązujemy referencję. Dzięki temu typowy przypadek (agent
 * ma prawdziwe id z wcześniejszego odczytu) nie kosztuje dodatkowego zapytania po całą listę.
 */
export async function resolveIdOrName(
  ref: string,
  label: string,
  findById: (id: string) => Promise<string | null>,
  load: () => Promise<NamedCandidate[]>
): Promise<string> {
  const direct = await findById(ref);
  if (direct) return direct;
  return resolveRefOrThrow(ref, label, load);
}

/**
 * Rozwiązanie referencji projektu zadań (025): agent często przekazuje NAZWĘ projektu („LZ") tam,
 * gdzie read-tool oczekuje identyfikatora. Zwracany kształt (`{ id }` albo `{ unresolved, matches,
 * available }`) zostaje, żeby komunikat błędu dla zadań był ten sam co przed 032 — z dodatkiem
 * informacji o wielu dopasowaniach. Samo dopasowanie robi wspólny `matchNamedRef`.
 */
export async function resolveProjectRef(
  userId: string,
  ref: string
): Promise<RefResolution> {
  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, name: true },
  });
  return matchNamedRef(ref, projects);
}

export async function accessibleListWhere(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return {
    OR: [
      { ownerId: userId },
      ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
    ],
  };
}

// Zakres własności (ownerId LUB zespół) dla modułów z modelem user/team.
export async function ownerScope(userId: string): Promise<{ OR: Record<string, unknown>[] }> {
  const teamIds = await getUserTeamIds(userId);
  return {
    OR: [
      { ownerId: userId },
      ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
    ],
  };
}

/**
 * Uruchamia jedno narzędzie odczytu w zakresie dostępu użytkownika.
 * Zwraca zwięzłą tablicę obiektów (gotową do serializacji JSON do transkryptu LLM).
 */
