"use client"

import { useState } from "react"
import { Plus, Trash2, Check, X } from "lucide-react"
import type { PermissionData, RoleWithPermissions, UserData } from "@/actions/access"
import {
  createPermission, updatePermission, deletePermission,
  toggleRolePermission, addUserRole, removeUserRole,
} from "@/actions/access"

type Tab = "permissions" | "roles" | "users"

interface Props {
  permissions: PermissionData[]
  rolePermissions: RoleWithPermissions[]
  users: UserData[]
  availableRoles: string[]
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "var(--accent-purple)",
  USER: "var(--accent-blue)",
  BETA_TESTER: "var(--accent-amber)",
}

// Brama do panelu /admin. Musi mieć ją zawsze co najmniej jeden użytkownik,
// inaczej nikt nie odzyska dostępu z poziomu UI (patrz doświadczenia.md 2026-05-30).
const ADMIN_PERM = "module.admin"

// Liczy odrębnych użytkowników mających dostęp do /admin przy danym zestawie ról.
function countAdminHolders(
  users: UserData[],
  rolePermissions: RoleWithPermissions[],
  opts?: { excludeRoleGrant?: string; removeUserRole?: { userId: string; role: string } },
): number {
  const adminRoles = rolePermissions
    .filter((rp) => rp.permissions.includes(ADMIN_PERM))
    .map((rp) => rp.role)
    .filter((r) => r !== opts?.excludeRoleGrant)
  const holders = new Set<string>()
  for (const u of users) {
    for (const r of u.roles) {
      if (opts?.removeUserRole && u.id === opts.removeUserRole.userId && r === opts.removeUserRole.role) continue
      if (adminRoles.includes(r)) { holders.add(u.id); break }
    }
  }
  return holders.size
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "permissions", label: "Uprawnienia" },
    { id: "roles", label: "Role" },
    { id: "users", label: "Użytkownicy" },
  ]
  return (
    <div className="flex gap-1 mb-6" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: active === t.id ? 600 : 400,
            color: active === t.id ? "var(--text-primary)" : "var(--text-muted)",
            background: "none",
            border: "none",
            borderBottom: active === t.id ? "2px solid var(--accent-blue)" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {children}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
      background: (ROLE_COLORS[role] ?? "var(--text-muted)") + "22",
      color: ROLE_COLORS[role] ?? "var(--text-muted)",
      border: `1px solid ${(ROLE_COLORS[role] ?? "var(--text-muted)") + "44"}`,
    }}>
      {role}
    </span>
  )
}

// ---------- Permissions Tab ----------
function PermissionsTab({ permissions, users, rolePermissions }: { permissions: PermissionData[]; users: UserData[]; rolePermissions: RoleWithPermissions[] }) {
  const [adding, setAdding] = useState(false)
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [saving, setSaving] = useState(false)

  const adminLocked = countAdminHolders(users, rolePermissions) > 0

  async function handleCreate() {
    if (!slug.trim() || !name.trim()) return
    setSaving(true)
    try { await createPermission(slug, name, desc) } finally { setSaving(false); setAdding(false); setSlug(""); setName(""); setDesc("") }
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć to uprawnienie? Zostanie też usunięte z ról.")) return
    try { await deletePermission(id) } catch (e) { alert(e instanceof Error ? e.message : "Nie udało się usunąć uprawnienia.") }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          {permissions.length} uprawnień zdefiniowanych
        </p>
        <button
          onClick={() => setAdding(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <Plus size={12} /> Dodaj uprawnienie
        </button>
      </div>

      <SectionCard>
        {adding && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (np. module.reports)"
                style={{ flex: 1, fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none" }} />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa"
                style={{ flex: 1, fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none" }} />
            </div>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opis (opcjonalnie)"
              style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none" }} />
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button onClick={() => setAdding(false)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>Anuluj</button>
              <button onClick={handleCreate} disabled={saving || !slug.trim() || !name.trim()}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "…" : "Dodaj"}
              </button>
            </div>
          </div>
        )}
        {permissions.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderBottom: i < permissions.length - 1 ? "1px solid var(--border)" : undefined }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <code style={{ fontSize: 12, color: "var(--accent-blue)", background: "var(--bg-elevated)", padding: "1px 6px", borderRadius: 4 }}>{p.slug}</code>
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{p.name}</span>
              </div>
              {p.description && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{p.description}</p>}
            </div>
            {p.slug === ADMIN_PERM && adminLocked ? (
              <span title="To brama dostępu do panelu administratora — nie można jej usunąć, dopóki ktoś z niej korzysta."
                style={{ flexShrink: 0, padding: 4, color: "var(--text-muted)", opacity: 0.4, display: "flex", cursor: "not-allowed" }}>
                <Trash2 size={13} />
              </span>
            ) : (
              <button onClick={() => handleDelete(p.id)}
                style={{ flexShrink: 0, padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", borderRadius: 4 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; e.currentTarget.style.background = "var(--bg-hover)" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "none" }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        {permissions.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Brak uprawnień</div>
        )}
      </SectionCard>
    </div>
  )
}

// ---------- Roles Tab ----------
function RolesTab({ rolePermissions, permissions, users }: { rolePermissions: RoleWithPermissions[]; permissions: PermissionData[]; users: UserData[] }) {
  const [toggling, setToggling] = useState<string | null>(null)

  // Czy odznaczenie module.admin dla tej roli zostawiłoby nikogo bez dostępu do /admin?
  function lastAdminGrant(role: string): boolean {
    const grantsAdmin = rolePermissions.find((rp) => rp.role === role)?.permissions.includes(ADMIN_PERM)
    if (!grantsAdmin) return false
    if (countAdminHolders(users, rolePermissions) === 0) return false
    return countAdminHolders(users, rolePermissions, { excludeRoleGrant: role }) === 0
  }

  async function handleToggle(role: string, slug: string) {
    const key = `${role}:${slug}`
    setToggling(key)
    try { await toggleRolePermission(role, slug) }
    catch (e) { alert(e instanceof Error ? e.message : "Nie udało się zmienić uprawnienia.") }
    finally { setToggling(null) }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {rolePermissions.map(({ role, permissions: rolePerms }) => (
        <div key={role}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <RoleBadge role={role} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{rolePerms.length} uprawnień</span>
          </div>
          <SectionCard>
            {permissions.map((p, i) => {
              const hasIt = rolePerms.includes(p.slug)
              const key = `${role}:${p.slug}`
              const isToggling = toggling === key
              const locked = p.slug === ADMIN_PERM && hasIt && lastAdminGrant(role)
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < permissions.length - 1 ? "1px solid var(--border)" : undefined }}>
                  <button
                    onClick={() => handleToggle(role, p.slug)}
                    disabled={isToggling || locked}
                    title={locked ? "To jedyna droga dostępu do panelu administratora — nie można jej odebrać." : undefined}
                    style={{
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${hasIt ? "var(--accent-blue)" : "var(--border)"}`,
                      background: hasIt ? "var(--accent-blue)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: locked ? "not-allowed" : isToggling ? "default" : "pointer", opacity: locked ? 0.55 : isToggling ? 0.5 : 1,
                    }}
                  >
                    {hasIt && <Check size={12} color="#fff" />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{p.name}</span>
                    <code style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)" }}>{p.slug}</code>
                  </div>
                </div>
              )
            })}
          </SectionCard>
        </div>
      ))}
      {rolePermissions.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>Brak zdefiniowanych ról</p>
      )}
    </div>
  )
}

// ---------- Users Tab ----------
function UsersTab({ users, availableRoles, rolePermissions }: { users: UserData[]; availableRoles: string[]; rolePermissions: RoleWithPermissions[] }) {
  const [adding, setAdding] = useState<string | null>(null) // userId being edited
  const [newRole, setNewRole] = useState("")
  const [saving, setSaving] = useState(false)

  // Czy usunięcie tej roli zostawiłoby nikogo z dostępem do /admin?
  function lastAdminRole(userId: string, role: string): boolean {
    if (countAdminHolders(users, rolePermissions) === 0) return false
    return countAdminHolders(users, rolePermissions, { removeUserRole: { userId, role } }) === 0
  }

  async function handleAddRole(userId: string) {
    if (!newRole) return
    setSaving(true)
    try { await addUserRole(userId, newRole) } finally { setSaving(false); setAdding(null); setNewRole("") }
  }

  async function handleRemoveRole(userId: string, role: string) {
    try { await removeUserRole(userId, role) } catch (e) { alert(e instanceof Error ? e.message : "Nie udało się usunąć roli.") }
  }

  return (
    <SectionCard>
      {users.map((user, i) => (
        <div key={user.id} style={{ padding: "12px 16px", borderBottom: i < users.length - 1 ? "1px solid var(--border)" : undefined }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0, marginBottom: 4 }}>
                {user.name ?? "—"}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginBottom: 6 }}>{user.email}</p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                {user.roles.map((role) => {
                  const locked = lastAdminRole(user.id, role)
                  return (
                    <div key={role} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <RoleBadge role={role} />
                      {locked ? (
                        <span title="Ostatnia rola dająca dostęp do panelu administratora — nie można jej usunąć."
                          style={{ padding: 2, color: "var(--text-muted)", opacity: 0.4, display: "flex", cursor: "not-allowed" }}>
                          <X size={10} />
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRemoveRole(user.id, role)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)", borderRadius: 3, display: "flex" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)" }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
                          title={`Usuń rolę ${role}`}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  )
                })}
                {adding === user.id ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                      style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none" }}>
                      <option value="">Wybierz rolę</option>
                      {availableRoles.filter((r) => !user.roles.includes(r)).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button onClick={() => handleAddRole(user.id)} disabled={!newRole || saving}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", cursor: "pointer" }}>
                      {saving ? "…" : "Dodaj"}
                    </button>
                    <button onClick={() => { setAdding(null); setNewRole("") }}
                      style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setAdding(user.id); setNewRole("") }}
                    style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                    <Plus size={10} /> Rola
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </SectionCard>
  )
}

// ---------- Main Component ----------
export function PermissionManager({ permissions, rolePermissions, users, availableRoles }: Props) {
  const [tab, setTab] = useState<Tab>("permissions")

  return (
    <div>
      <TabBar active={tab} onChange={setTab} />
      {tab === "permissions" && <PermissionsTab permissions={permissions} users={users} rolePermissions={rolePermissions} />}
      {tab === "roles" && <RolesTab rolePermissions={rolePermissions} permissions={permissions} users={users} />}
      {tab === "users" && <UsersTab users={users} availableRoles={availableRoles} rolePermissions={rolePermissions} />}
    </div>
  )
}
