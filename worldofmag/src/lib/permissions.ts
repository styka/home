"use server"

import { prisma } from "@/lib/prisma"
import type { SharePermission, ResourceType } from "@/types"

const PERMISSION_RANK: Record<SharePermission, number> = {
  VIEW: 1,
  EDIT: 2,
  MANAGE: 3,
}

function hasMinPermission(actual: SharePermission, required: SharePermission) {
  return PERMISSION_RANK[actual] >= PERMISSION_RANK[required]
}

/**
 * Returns the effective permission a user has on a resource, or null if none.
 * Checks: direct ownership, team ownership (user is a member), explicit Share grants.
 */
export async function getPermission(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
): Promise<SharePermission | null> {
  if (resourceType === "ShoppingList") {
    const list = await prisma.shoppingList.findUnique({
      where: { id: resourceId },
      include: {
        ownerTeam: { include: { members: { where: { userId } } } },
      },
    })
    if (!list) return null
    if (list.ownerId === userId) return "MANAGE"
    if (list.ownerTeam?.members.length) return "MANAGE"
  }

  if (resourceType === "Action") {
    const action = await prisma.action.findUnique({
      where: { id: resourceId },
      include: {
        ownerTeam: { include: { members: { where: { userId } } } },
      },
    })
    if (!action) return null
    if (action.ownerUserId === userId) return "MANAGE"
    if (action.ownerTeam?.members.length) return "MANAGE"
  }

  // Explicit Share grants (user direct or via team membership)
  const userTeamIds = (
    await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } })
  ).map((m) => m.teamId)

  const share = await prisma.share.findFirst({
    where: {
      resourceType,
      resourceId,
      OR: [
        { recipientUserId: userId },
        ...(userTeamIds.length ? [{ recipientTeamId: { in: userTeamIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  })

  return share ? (share.permission as SharePermission) : null
}

export async function assertPermission(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  required: SharePermission,
) {
  const perm = await getPermission(userId, resourceType, resourceId)
  if (!perm || !hasMinPermission(perm, required)) {
    throw new Error(`Access denied — ${required} required on ${resourceType}`)
  }
}
