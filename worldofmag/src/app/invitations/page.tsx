import { getPendingInvitations } from "@/actions/invitations"
import { redeemResourceInvitations } from "@/actions/sharing"
import InvitationsList from "@/components/teams/InvitationsList"
import { Mail } from "lucide-react"

export default async function InvitationsPage() {
  // 090 (zadanie 14): zaproszenie do POJEDYNCZEGO zasobu wystawia się na adres e-mail, bo w chwili
  // wystawienia konta może jeszcze nie być. Realizujemy je tutaj, przy pierwszym wejściu — nie ma
  // klienta pocztowego (081), więc ta strona jest jedynym miejscem, w którym zaproszenie może się
  // spotkać z właścicielem adresu. Błąd realizacji nie może zablokować listy zaproszeń zespołowych.
  const odebraneZasoby = await redeemResourceInvitations().catch(() => 0)
  const invitations = await getPendingInvitations()

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--bg-base)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Mail size={22} style={{ color: "var(--text-secondary)" }} />
          Zaproszenia
        </h1>
        {odebraneZasoby > 0 && (
          <div style={{ fontSize: 13, color: "var(--accent-green)", lineHeight: 1.5 }}>
            Odebrano dostęp do {odebraneZasoby}{" "}
            {odebraneZasoby === 1 ? "udostępnionego zasobu" : "udostępnionych zasobów"} — znajdziesz je
            na stronie „Udostępnione mi”.
          </div>
        )}
        <InvitationsList invitations={invitations} />
      </div>
    </div>
  )
}
