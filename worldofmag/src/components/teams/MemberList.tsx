"use client"

import { changeMemberRole, removeMember } from "@/actions/teams"
import { useState } from "react"

type Member = {
  userId: string
  role: string
  user: { id: string; name: string | null; email: string | null; avatarUrl: string | null }
}

export default function MemberList({
  teamId,
  members,
  currentUserId,
  currentUserRole,
}: {
  teamId: string
  members: Member[]
  currentUserId: string
  currentUserRole: string
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const isOwner = currentUserRole === "OWNER"
  const isAdmin = currentUserRole === "ADMIN" || isOwner

  async function handleRoleChange(userId: string, newRole: "ADMIN" | "MEMBER") {
    setBusy(userId)
    try {
      await changeMemberRole(teamId, userId, newRole)
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm("Usunąć tego użytkownika z teamu?")) return
    setBusy(userId)
    try {
      await removeMember(teamId, userId)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {members.map((m) => {
        const isMe = m.userId === currentUserId
        const canChangeRole = isOwner && !isMe && m.role !== "OWNER"
        const canRemove =
          isAdmin &&
          !isMe &&
          m.role !== "OWNER" &&
          !(currentUserRole === "ADMIN" && m.role === "ADMIN")

        return (
          <div
            key={m.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--bg-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "var(--text-secondary)",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {m.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (m.user.name ?? m.user.email ?? "?")[0].toUpperCase()
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text-primary)", fontSize: 14 }}>
                {m.user.name ?? m.user.email}
                {isMe && <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 6 }}>(ty)</span>}
              </div>
              {m.user.name && (
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{m.user.email}</div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {canChangeRole ? (
                <select
                  value={m.role}
                  disabled={busy === m.userId}
                  onChange={(e) => handleRoleChange(m.userId, e.target.value as "ADMIN" | "MEMBER")}
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              ) : (
                <span style={{ color: "var(--text-muted)", fontSize: 12, padding: "4px 8px" }}>
                  {m.role}
                </span>
              )}
              {canRemove && (
                <button
                  onClick={() => handleRemove(m.userId)}
                  disabled={busy === m.userId}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: "4px",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
