"use client"

import { changeMemberRole, removeMember, setMemberModuleAccess } from "@/actions/teams"
import { useState } from "react"
import { RESTRICTABLE_MODULES, moduleLabel, parseModuleAccess } from "@/lib/teams/memberAccess"

type Member = {
  userId: string
  role: string
  moduleAccess?: string | null
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
  const [accessOpen, setAccessOpen] = useState<string | null>(null)
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
        // Z-194 (T-12): „rodzic" (ADMIN/OWNER) może ograniczyć dostęp domownika do modułów.
        // Nie dotyczy właściciela ani samego siebie (pełny dostęp z definicji).
        const canSetAccess = isAdmin && !isMe && m.role !== "OWNER"

        return (
          <div key={m.userId}>
          <div
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
              {canSetAccess && (
                <button
                  onClick={() => setAccessOpen((cur) => (cur === m.userId ? null : m.userId))}
                  style={{
                    background: accessOpen === m.userId ? "var(--bg-hover)" : "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: "4px 8px",
                  }}
                  title="Ogranicz dostęp domownika do modułów"
                >
                  Dostęp
                </button>
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
          {canSetAccess && accessOpen === m.userId && (
            <ModuleAccessEditor
              teamId={teamId}
              userId={m.userId}
              name={m.user.name ?? m.user.email ?? "domownik"}
              moduleAccess={m.moduleAccess ?? null}
              onClose={() => setAccessOpen(null)}
            />
          )}
          </div>
        )
      })}
    </div>
  )
}

// Z-194 (T-12): edytor dostępu domownika — checkboxy modułów współdzielonych.
// Brak ograniczeń (wszystkie zaznaczone) zapisuje się jako `null` (pełny dostęp).
function ModuleAccessEditor({
  teamId,
  userId,
  name,
  moduleAccess,
  onClose,
}: {
  teamId: string
  userId: string
  name: string
  moduleAccess: string | null
  onClose: () => void
}) {
  // null = brak ograniczeń → wszystkie zaznaczone na starcie.
  const initial = parseModuleAccess(moduleAccess)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial === null ? RESTRICTABLE_MODULES : initial)
  )
  const [saving, setSaving] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      // Wszystkie zaznaczone = brak ograniczeń (null = pełny dostęp).
      const all = selected.size === RESTRICTABLE_MODULES.length
      await setMemberModuleAccess(teamId, userId, all ? null : RESTRICTABLE_MODULES.filter((m) => selected.has(m)))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        padding: "10px 12px 12px",
        marginBottom: 8,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
        Moduły, do których <strong style={{ color: "var(--text-secondary)" }}>{name}</strong> ma dostęp
        we współdzielonych zasobach zespołu. Odznacz, by ograniczyć.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 4 }}>
        {RESTRICTABLE_MODULES.map((id) => (
          <label key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} style={{ width: 16, height: 16 }} />
            {moduleLabel(id)}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ background: "var(--accent-blue)", color: "var(--on-accent)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, padding: "5px 12px", cursor: "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Zapisuję…" : "Zapisz dostęp"}
        </button>
        <button
          onClick={onClose}
          style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, padding: "5px 12px", cursor: "pointer" }}
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}
