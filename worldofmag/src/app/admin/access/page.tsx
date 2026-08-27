
import { getTranslations } from "next-intl/server";import { redirect } from "next/navigation"
import { auth } from "@/platform/auth/session"
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions"
import { Shield } from "lucide-react"
import { getPermissions, getRolePermissions, getUsers, getAvailableRoles } from "@/actions/access"
import { PermissionManager } from "@/components/admin/PermissionManager"
import { PowrotDoPanelu } from "@/components/admin/PowrotDoPanelu";

export const dynamic = "force-dynamic"

export default async function AccessPage() {
  const t = await getTranslations("app.admin.access.page");
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
        {/* 110 (AC-12): powrót do panelu. Ta strona go nie miała — z narzędzia wracało się
            menu bocznym albo przyciskiem wstecz. */}
        <PowrotDoPanelu odstep={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <Shield size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {t("zarzadzanieDostepem")}
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
