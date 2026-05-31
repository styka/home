import { auth } from "@/lib/auth"
import { getMyTeams } from "@/actions/teams"
import { getRecentActivity } from "@/actions/activity"
import { getMenuPrefs } from "@/actions/menuPrefs"
import { signOut } from "@/lib/auth"
import Link from "next/link"
import { Settings } from "lucide-react"
import { ActivityFeed } from "@/components/home/ActivityFeed"
import { MenuPrefsEditor } from "@/components/settings/MenuPrefsEditor"

export default async function SettingsPage() {
  const session = await auth()
  const teams = await getMyTeams()
  const recentActivity = await getRecentActivity(30)
  const userPermissions: string[] = session?.user?.permissions ?? []
  const menuPrefs = await getMenuPrefs()
  const activityForUI = recentActivity.map((a) => ({
    module: a.module,
    action: a.action,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
  }))

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--bg-base)", padding: "24px 16px" }}>
    <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <Settings size={22} style={{ color: "var(--text-secondary)" }} />
        Ustawienia
      </h1>

      {/* Profile */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Profil
        </h2>
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}>
          {session?.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          <div>
            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {session?.user?.name}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {session?.user?.email}
            </div>
          </div>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/auth/signin" })
            }}
            style={{ marginLeft: "auto" }}
          >
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Wyloguj
            </button>
          </form>
        </div>
      </section>

      {/* Teams */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Teamy
          </h2>
          <Link
            href="/settings/team/new"
            style={{
              padding: "6px 14px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            + Nowy team
          </Link>
        </div>

        {teams.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Nie należysz jeszcze do żadnego teamu.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/settings/team/${team.id}`}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{team.name}</div>
                  {team.description && (
                    <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                      {team.description}
                    </div>
                  )}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {team._count.members} {team._count.members === 1 ? "member" : "members"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Menu */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Menu
        </h2>
        <MenuPrefsEditor permissions={userPermissions} prefs={menuPrefs} />
      </section>

      {/* Activity */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Aktywność
        </h2>
        {activityForUI.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Brak ostatniej aktywności.
          </p>
        ) : (
          <ActivityFeed activities={activityForUI} permissions={userPermissions} />
        )}
      </section>

    </div>
    </div>
  )
}
