"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return session.user as { id: string; role?: string }
}

async function requireTeamRole(
  teamId: string,
  userId: string,
  minRole: "MEMBER" | "ADMIN" | "OWNER"
) {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  })
  if (!member) throw new Error("Not a team member")
  const hierarchy: Record<string, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 }
  if (hierarchy[member.role] < hierarchy[minRole]) {
    throw new Error("Insufficient team role")
  }
  return member
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function createTeam(name: string, description?: string) {
  const user = await requireAuth()
  const team = await prisma.team.create({
    data: {
      name,
      description,
      ownerId: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
    include: { members: true },
  })
  revalidatePath("/settings")
  return team
}

export async function getMyTeams() {
  const user = await requireAuth()
  return prisma.team.findMany({
    where: { members: { some: { userId: user.id } } },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
      _count: { select: { members: true, subTeams: true } },
    },
    orderBy: { createdAt: "asc" },
  })
}

export async function getTeam(teamId: string) {
  const user = await requireAuth()
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
      subTeams: { include: { _count: { select: { members: true } } } },
      parentTeam: { select: { id: true, name: true } },
    },
  })
  if (!team) throw new Error("Team not found")
  const isMember = team.members.some((m) => m.userId === user.id)
  if (!isMember && user.role !== "ADMIN") throw new Error("Access denied")
  return team
}

export async function updateTeam(
  teamId: string,
  data: { name?: string; description?: string; avatarUrl?: string }
) {
  const user = await requireAuth()
  await requireTeamRole(teamId, user.id, "ADMIN")
  await prisma.team.update({ where: { id: teamId }, data })
  revalidatePath(`/settings/team/${teamId}`)
}

export async function deleteTeam(teamId: string) {
  const user = await requireAuth()
  await requireTeamRole(teamId, user.id, "OWNER")
  const [ownedLists] = await Promise.all([
    prisma.shoppingList.count({ where: { ownerTeamId: teamId } }),
  ])
  if (ownedLists > 0) {
    throw new Error("Transfer or delete team resources before deleting the team")
  }
  await prisma.team.delete({ where: { id: teamId } })
  revalidatePath("/settings")
}

// ─── Members ────────────────────────────────────────────────────────────────

export async function changeMemberRole(
  teamId: string,
  targetUserId: string,
  newRole: "ADMIN" | "MEMBER"
) {
  const user = await requireAuth()
  await requireTeamRole(teamId, user.id, "OWNER")
  if (targetUserId === user.id) throw new Error("Cannot change own role")
  await prisma.teamMember.update({
    where: { teamId_userId: { teamId, userId: targetUserId } },
    data: { role: newRole },
  })
  revalidatePath(`/settings/team/${teamId}`)
}

export async function removeMember(teamId: string, targetUserId: string) {
  const user = await requireAuth()
  const requester = await requireTeamRole(teamId, user.id, "ADMIN")
  const target = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  })
  if (!target) throw new Error("Member not found")
  if (target.role === "OWNER") throw new Error("Cannot remove owner")
  if (requester.role === "ADMIN" && target.role === "ADMIN") {
    throw new Error("Admins cannot remove other admins")
  }
  await prisma.teamMember.delete({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  })
  revalidatePath(`/settings/team/${teamId}`)
}

export async function leaveTeam(teamId: string) {
  const user = await requireAuth()
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  })
  if (!member) throw new Error("Not a member")
  if (member.role === "OWNER") throw new Error("Owner cannot leave — transfer ownership first")
  await prisma.teamMember.delete({
    where: { teamId_userId: { teamId, userId: user.id } },
  })
  revalidatePath("/settings")
}

export async function transferTeamOwnership(teamId: string, newOwnerId: string) {
  const user = await requireAuth()
  await requireTeamRole(teamId, user.id, "OWNER")
  const newOwnerMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: newOwnerId } },
  })
  if (!newOwnerMember) throw new Error("New owner must be a team member")

  await prisma.$transaction([
    prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: user.id } },
      data: { role: "ADMIN" },
    }),
    prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: newOwnerId } },
      data: { role: "OWNER" },
    }),
    prisma.team.update({ where: { id: teamId }, data: { ownerId: newOwnerId } }),
  ])
  revalidatePath(`/settings/team/${teamId}`)
}

// ─── Sub-teams ──────────────────────────────────────────────────────────────

export async function createSubTeam(
  parentTeamId: string,
  name: string,
  description?: string
) {
  const user = await requireAuth()
  await requireTeamRole(parentTeamId, user.id, "ADMIN")
  const team = await prisma.team.create({
    data: {
      name,
      description,
      ownerId: user.id,
      parentTeamId,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  })
  revalidatePath(`/settings/team/${parentTeamId}`)
  return team
}
