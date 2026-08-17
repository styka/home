
import { ownedOrAsync , getUserTeamIds, requireAuth } from "@/platform/auth/serverUtils"

export { getUserTeamIds }

/** Returns the current authenticated user id, or throws ("Unauthorized"). */
export async function requireUserId(): Promise<string> {
  const user = await requireAuth()
  return user.id
}

/**
 * Standard Prisma `where` fragment for the three-tier ownership model
 * (private `ownerId` OR team `ownerTeamId`). Use in list queries so the
 * access pattern is expressed once instead of being copy-pasted per action.
 *
 *   const { userId, teamIds } = await getUserScope()
 *   prisma.note.findMany({ where: ownedByWhere(userId, teamIds) })
 */
export async function ownedByWhere(userId: string) {
  return { OR: await ownedOrAsync(userId) }
}

/**
 * Resolves the current user id together with their team ids in one call —
 * the pair almost every ownership-scoped action needs up front.
 */
export async function getUserScope(): Promise<{ userId: string; teamIds: string[] }> {
  const userId = await requireUserId()
  const teamIds = await getUserTeamIds(userId)
  return { userId, teamIds }
}

/**
 * 078 (zadanie 11, etap 4 część 2) — GUARD REKORDU IDZIE PO PRZESTRZENI.
 *
 * Poprzednia wersja czytała `ownerId`/`ownerTeamId` z wybranego rekordu, więc umiera razem
 * z kolumnami. Reguła jest przeniesiona **jeden do jednego**, nie przepisana: prawo do rekordu
 * daje członkostwo w jego przestrzeni — a lustro (`Workspace`/`WorkspaceMember`, zadanie 9)
 * gwarantuje, że `ownerId = ja` to dokładnie „przestrzeń osobista moja", a `ownerTeamId = t`
 * to dokładnie „przestrzeń zespołu t", której jestem członkiem wtedy i tylko wtedy, gdy jestem
 * członkiem `t`.
 *
 * **Dlaczego czysty rdzeń osobno.** `assertOwnership` musi teraz odczytać kontekst dostępu, czyli
 * być asynchroniczna. Sama REGUŁA pozostaje jednak czystą funkcją dwóch argumentów i tylko taka
 * daje się sprawdzić tabelą prawdy bez bazy — dokładnie tą samą tabelą, co przed zmianą
 * (`lib/__tests__/ownership.test.ts`), komórka w komórkę. Gdyby reguła siedziała w środku funkcji
 * asynchronicznej, dowód równoważności wymagałby atrapy kontekstu, czyli sprawdzałby atrapę.
 */
export function maDostepDoPrzestrzeni(
  entity: { workspaceId?: string | null } | null,
  workspaceIds: string[]
): "brak" | "obcy" | "ok" {
  if (!entity) return "brak"
  // `workspaceId` jest NOT NULL na wszystkich 40 tabelach objętych etapem 4 (migracja 0235), więc
  // pusta wartość nie jest tu „rekordem niczyim" — jest rekordem z tabeli, która do tego guardu
  // nie należy (słownik z `ownedOrSystemWhere`). Odmowa jest wtedy właściwą odpowiedzią.
  if (!entity.workspaceId) return "obcy"
  return workspaceIds.includes(entity.workspaceId) ? "ok" : "obcy"
}

/**
 * Throws if the entity does not live in any workspace the user belongs to.
 * Entity must expose `workspaceId`.
 */
export async function assertOwnership(
  entity: { workspaceId?: string | null } | null,
  userId: string
): Promise<void> {
  const { getAccessContext } = await import("@/platform/sharing/cache")
  const { workspaceIds } = await getAccessContext(userId)
  const wynik = maDostepDoPrzestrzeni(entity, workspaceIds)
  if (wynik === "brak") throw new Error("Not found")
  if (wynik === "obcy") throw new Error("Forbidden")
}
