"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return session.user as { id: string }
}

export async function inviteUser(teamId: string, targetEmail: string) {
  const user = await requireAuth()

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  })
  if (!member || member.role === "MEMBER") {
    throw new Error("Admin role required to invite")
  }

  const target = await prisma.user.findUnique({ where: { email: targetEmail } })
  if (!target) {
    throw new Error("User not found — they must sign in to WorldOfMag first")
  }

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: target.id } },
  })
  if (existing) throw new Error("User is already a team member")

  await prisma.teamInvitation.upsert({
    where: { teamId_invitedUserId: { teamId, invitedUserId: target.id } },
    update: { status: "PENDING", invitedById: user.id, updatedAt: new Date() },
    create: {
      teamId,
      invitedById: user.id,
      invitedUserId: target.id,
      status: "PENDING",
    },
  })
  revalidatePath(`/settings/team/${teamId}`)
}

export async function getPendingInvitations() {
  const user = await requireAuth()
  return prisma.teamInvitation.findMany({
    where: { invitedUserId: user.id, status: "PENDING" },
    include: {
      team: { select: { id: true, name: true, avatarUrl: true } },
      invitedBy: { select: { name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function acceptInvitation(invitationId: string) {
  const user = await requireAuth()
  const invitation = await prisma.teamInvitation.findUnique({
    where: { id: invitationId },
  })
  if (!invitation) throw new Error("Invitation not found")
  if (invitation.invitedUserId !== user.id) throw new Error("Not your invitation")
  if (invitation.status !== "PENDING") throw new Error("Invitation already handled")

  await prisma.$transaction([
    prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED" },
    }),
    prisma.teamMember.create({
      data: { teamId: invitation.teamId, userId: user.id, role: "MEMBER" },
    }),
  ])
  revalidatePath("/invitations")
  revalidatePath("/settings")
}

export async function rejectInvitation(invitationId: string) {
  const user = await requireAuth()
  const invitation = await prisma.teamInvitation.findUnique({
    where: { id: invitationId },
  })
  if (!invitation) throw new Error("Invitation not found")
  if (invitation.invitedUserId !== user.id) throw new Error("Not your invitation")
  if (invitation.status !== "PENDING") throw new Error("Invitation already handled")

  await prisma.teamInvitation.update({
    where: { id: invitationId },
    data: { status: "REJECTED" },
  })
  revalidatePath("/invitations")
}

export async function getPendingInvitationsCount(): Promise<number> {
  const user = await requireAuth()
  return prisma.teamInvitation.count({
    where: { invitedUserId: user.id, status: "PENDING" },
  })
}
