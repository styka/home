import { cookies } from "next/headers"
import type { WorkspaceId } from "@/types"

const COOKIE_NAME = "workspace"
const DEFAULT_WORKSPACE: WorkspaceId = "user:me"

export function getWorkspaceId(): WorkspaceId {
  const value = cookies().get(COOKIE_NAME)?.value
  if (!value) return DEFAULT_WORKSPACE
  if (value === "user:me" || value === "all" || value.startsWith("team:")) {
    return value as WorkspaceId
  }
  return DEFAULT_WORKSPACE
}

export function buildWorkspaceFilter(userId: string, workspaceId: WorkspaceId) {
  if (workspaceId === "user:me") {
    return { ownerId: userId }
  }
  if (workspaceId.startsWith("team:")) {
    const teamId = workspaceId.slice(5)
    return { ownerTeamId: teamId }
  }
  // "all" — lists owned by user OR teams they belong to (handled via OR in caller)
  return null
}
