"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { ActionStatus, RecurPattern } from "@/types"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return session.user
}

export async function getActionComponents() {
  return prisma.actionComponent.findMany({ orderBy: { name: "asc" } })
}

export async function getMyActions() {
  const user = await requireAuth()

  const teamIds = (
    await prisma.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } })
  ).map((m) => m.teamId)

  return prisma.action.findMany({
    where: {
      OR: [
        { ownerUserId: user.id },
        ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
    },
    include: {
      component: true,
      ownerTeam: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  })
}

export async function createAction(data: {
  title: string
  description?: string
  componentId: string
  params?: string
  dueDate?: string
  ownerTeamId?: string
  isRecurring?: boolean
  recurPattern?: RecurPattern
  recurInterval?: number
}) {
  const user = await requireAuth()

  const action = await prisma.action.create({
    data: {
      title: data.title,
      description: data.description,
      componentId: data.componentId,
      params: data.params,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      ownerUserId: data.ownerTeamId ? undefined : user.id,
      ownerTeamId: data.ownerTeamId ?? undefined,
      isRecurring: data.isRecurring ?? false,
      recurPattern: data.recurPattern,
      recurInterval: data.recurInterval,
      nextDueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
  })

  revalidatePath("/actions")
  return action
}

export async function updateActionStatus(actionId: string, status: ActionStatus) {
  const user = await requireAuth()

  const action = await prisma.action.findUnique({ where: { id: actionId } })
  if (!action) throw new Error("Action not found")
  if (action.ownerUserId !== user.id && action.ownerTeamId) {
    const isMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: action.ownerTeamId, userId: user.id } },
    })
    if (!isMember) throw new Error("Access denied")
  } else if (action.ownerUserId !== user.id) {
    throw new Error("Access denied")
  }

  const updates: Record<string, unknown> = { status }

  if (status === "DONE") {
    updates.completedAt = new Date()
    // Advance recurrence if applicable
    if (action.isRecurring && action.recurPattern) {
      updates.nextDueDate = calcNextDue(action)
      updates.lastAdvancedAt = new Date()
      updates.status = "ACTIVE"
      updates.completedAt = null
    }
  }

  await prisma.action.update({ where: { id: actionId }, data: updates })
  revalidatePath("/actions")
}

export async function deleteAction(actionId: string) {
  const user = await requireAuth()

  const action = await prisma.action.findUnique({ where: { id: actionId } })
  if (!action) throw new Error("Action not found")
  if (action.ownerUserId !== user.id) throw new Error("Access denied")

  await prisma.action.delete({ where: { id: actionId } })
  revalidatePath("/actions")
}

// ─── Recurrence helper ────────────────────────────────────────────────────

function calcNextDue(action: {
  nextDueDate: Date | null
  completedAt: Date | null
  recurPattern: string | null
  recurInterval: number | null
  nextDueDateBasis: string | null
}): Date {
  const base =
    action.nextDueDateBasis === "COMPLETION" && action.completedAt
      ? action.completedAt
      : action.nextDueDate ?? new Date()

  const interval = action.recurInterval ?? 1
  const d = new Date(base)

  switch (action.recurPattern) {
    case "DAILY":
      d.setDate(d.getDate() + interval)
      break
    case "WEEKLY":
      d.setDate(d.getDate() + interval * 7)
      break
    case "MONTHLY":
      d.setMonth(d.getMonth() + interval)
      break
    case "YEARLY":
      d.setFullYear(d.getFullYear() + interval)
      break
  }

  return d
}
