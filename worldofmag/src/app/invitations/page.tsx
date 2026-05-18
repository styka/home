import { getPendingInvitations } from "@/actions/invitations"
import InvitationsList from "@/components/teams/InvitationsList"
import { Mail } from "lucide-react"

export default async function InvitationsPage() {
  const invitations = await getPendingInvitations()

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--bg-base)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Mail size={22} style={{ color: "var(--text-secondary)" }} />
          Zaproszenia
        </h1>
        <InvitationsList invitations={invitations} />
      </div>
    </div>
  )
}
