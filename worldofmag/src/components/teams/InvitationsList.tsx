"use client"

import { acceptInvitation, rejectInvitation } from "@/actions/invitations"
import { useState } from "react"

type Invitation = {
  id: string
  team: { id: string; name: string; avatarUrl: string | null }
  invitedBy: { name: string | null; email: string | null; avatarUrl: string | null }
  createdAt: Date
}

export default function InvitationsList({ invitations }: { invitations: Invitation[] }) {
  const [busy, setBusy] = useState<string | null>(null)

  if (invitations.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
        Brak oczekujących zaproszeń.
      </p>
    )
  }

  async function handle(id: string, action: "accept" | "reject") {
    setBusy(id)
    try {
      if (action === "accept") await acceptInvitation(id)
      else await rejectInvitation(id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {invitations.map((inv) => (
        <div
          key={inv.id}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: 15 }}>
              {inv.team.name}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
              od {inv.invitedBy.name ?? inv.invitedBy.email}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handle(inv.id, "accept")}
              disabled={busy === inv.id}
              style={{
                padding: "6px 14px",
                background: "var(--accent-green, #22c55e)",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
                opacity: busy === inv.id ? 0.5 : 1,
              }}
            >
              Przyjmij
            </button>
            <button
              onClick={() => handle(inv.id, "reject")}
              disabled={busy === inv.id}
              style={{
                padding: "6px 14px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
                opacity: busy === inv.id ? 0.5 : 1,
              }}
            >
              Odrzuć
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
