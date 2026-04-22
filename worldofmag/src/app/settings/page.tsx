import { auth } from "@/lib/auth"
import { getMyTeams } from "@/actions/teams"
import { signOut } from "@/lib/auth"
import Link from "next/link"

export default async function SettingsPage() {
  const session = await auth()
  const teams = await getMyTeams()

  return (
    <div style={{ padding: "32px", maxWidth: 720 }}>
      {/* Profile */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 600 }}>
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
    </div>
  )
}
