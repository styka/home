import { auth } from "@/lib/auth"
import { getTeam, deleteTeam } from "@/actions/teams"
import { getPendingInvitations } from "@/actions/invitations"
import MemberList from "@/components/teams/MemberList"
import InviteMemberForm from "@/components/teams/InviteMemberForm"
import Link from "next/link"
import { redirect, notFound } from "next/navigation"

export default async function TeamSettingsPage({
  params,
}: {
  params: { teamId: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  let team
  try {
    team = await getTeam(params.teamId)
  } catch {
    notFound()
  }

  const myMembership = team.members.find((m) => m.userId === session.user!.id)
  const myRole = myMembership?.role ?? "MEMBER"
  const isOwner = myRole === "OWNER"
  const isAdmin = myRole === "ADMIN" || isOwner

  return (
    <div style={{ padding: "32px", maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <Link
          href="/settings"
          style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}
        >
          ← Ustawienia
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 600 }}>
          {team.name}
        </h1>
      </div>

      {/* Breadcrumb — parent team */}
      {team.parentTeam && (
        <div style={{ marginBottom: 16, color: "var(--text-muted)", fontSize: 13 }}>
          Sub-team of{" "}
          <Link
            href={`/settings/team/${team.parentTeam.id}`}
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            {team.parentTeam.name}
          </Link>
        </div>
      )}

      {/* Members */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Członkowie ({team.members.length})
        </h2>
        <MemberList
          teamId={team.id}
          members={team.members}
          currentUserId={session.user.id}
          currentUserRole={myRole}
        />
      </section>

      {/* Invite */}
      {isAdmin && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Zaproś użytkownika
          </h2>
          <InviteMemberForm teamId={team.id} />
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
            Użytkownik musi wcześniej zalogować się do WorldOfMag.
          </p>
        </section>
      )}

      {/* Sub-teams */}
      {team.subTeams.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Sub-teamy
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {team.subTeams.map((sub) => (
              <Link
                key={sub.id}
                href={`/settings/team/${sub.id}`}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ color: "var(--text-primary)", fontSize: 14 }}>{sub.name}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {sub._count.members} members
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Danger zone */}
      {isOwner && (
        <section>
          <h2 style={{ color: "#ef4444", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Strefa niebezpieczna
          </h2>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid #ef444440",
            borderRadius: 8,
            padding: "16px 20px",
          }}>
            <form
              action={async () => {
                "use server"
                await deleteTeam(params.teamId)
                redirect("/settings")
              }}
            >
              <button
                type="submit"
                style={{
                  padding: "8px 16px",
                  background: "none",
                  border: "1px solid #ef4444",
                  borderRadius: 6,
                  color: "#ef4444",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Usuń team
              </button>
              <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
                Możliwe tylko gdy team nie posiada żadnych list zakupów.
              </p>
            </form>
          </div>
        </section>
      )}
    </div>
  )
}
