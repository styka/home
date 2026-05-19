import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { Shield } from "lucide-react"
import { getPermissions, getRolePermissions, getUsers, getAvailableRoles } from "@/actions/access"
import { PermissionManager } from "@/components/admin/PermissionManager"

export const dynamic = "force-dynamic"

export default async function AccessPage() {
  const session = await auth()
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/")

  const [permissions, rolePermissions, users, availableRoles] = await Promise.all([
    getPermissions(),
    getRolePermissions(),
    getUsers(),
    getAvailableRoles(),
  ])

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <Shield size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Zarządzanie dostępem
          </h1>
        </div>
        <PermissionManager
          permissions={permissions}
          rolePermissions={rolePermissions}
          users={users}
          availableRoles={availableRoles}
        />
      </div>
    </div>
  )
}
