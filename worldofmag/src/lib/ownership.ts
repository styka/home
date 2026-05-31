import { getUserTeamIds, requireUserId } from "@/lib/server-utils"

export { requireUserId, getUserTeamIds }

/**
 * Standard Prisma `where` fragment for the three-tier ownership model
 * (private `ownerId` OR team `ownerTeamId`). Use in list queries so the
 * access pattern is expressed once instead of being copy-pasted per action.
 *
 *   const teamIds = await getUserTeamIds(userId)
 *   prisma.note.findMany({ where: ownedByWhere(userId, teamIds) })
 */
export function ownedByWhere(userId: string, teamIds: string[]) {
  return {
    OR: [
      { ownerId: userId },
      ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : []),
    ],
  }
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
 * Throws if the entity is neither owned by the user nor by one of their teams.
 * Entity must expose `ownerId` / `ownerTeamId` (null-able) fields.
 */
export function assertOwnership(
  entity: { ownerId?: string | null; ownerTeamId?: string | null } | null,
  userId: string,
  teamIds: string[]
): void {
  if (!entity) throw new Error("Not found")
  const ownsDirectly = entity.ownerId === userId
  const ownsViaTeam = entity.ownerTeamId != null && teamIds.includes(entity.ownerTeamId)
  if (!ownsDirectly && !ownsViaTeam) throw new Error("Forbidden")
}
