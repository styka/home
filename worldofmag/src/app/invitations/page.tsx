import { getPendingInvitations } from "@/actions/invitations"
import InvitationsList from "@/components/teams/InvitationsList"

export default async function InvitationsPage() {
  const invitations = await getPendingInvitations()

  return (
    <div style={{ padding: "32px", maxWidth: 640 }}>
      <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
        Zaproszenia do teamów
      </h1>
      <InvitationsList invitations={invitations} />
    </div>
  )
}
