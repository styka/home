import Link from "next/link"

type Ref = { id: string; name: string } | null

/**
 * Z-195: karta onboardingu „rodziny" (household) — checklist pierwszych kroków:
 * potwierdza utworzenie, podpowiada zaproszenie domowników i daje deep-linki do
 * domyślnych wspólnych zasobów (zakupy/zadania/budżet). Komponent czysto
 * prezentacyjny (server) — dane z `getHouseholdOnboarding`.
 */
export default function HouseholdOnboarding({
  hasInvitedOthers,
  sharedList,
  sharedProject,
  sharedWallet,
}: {
  hasInvitedOthers: boolean
  sharedList: Ref
  sharedProject: Ref
  sharedWallet: Ref
}) {
  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    fontSize: 14,
    color: "var(--text-secondary)",
    padding: "4px 0",
  }
  const linkStyle: React.CSSProperties = { color: "var(--accent-blue)", textDecoration: "none" }

  const shared: { label: string; ref: Ref; href: (id: string) => string }[] = [
    { label: "Zakupy", ref: sharedList, href: (id) => `/shopping/${id}` },
    { label: "Zadania", ref: sharedProject, href: (id) => `/tasks/${id}` },
    { label: "Budżet", ref: sharedWallet, href: (id) => `/portfel/${id}` },
  ]

  return (
    <section
      style={{
        marginBottom: 40,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "16px 20px",
      }}
    >
      <h2 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
        🏡 Pierwsze kroki w rodzinie
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 12 }}>
        Wszystko, co dodasz na wspólnych listach poniżej, widzą wszyscy domownicy.
      </p>

      <div style={itemStyle}>
        <span aria-hidden>✅</span>
        <span>Rodzina utworzona</span>
      </div>

      <div style={itemStyle}>
        <span aria-hidden>{hasInvitedOthers ? "✅" : "▢"}</span>
        <span>
          {hasInvitedOthers
            ? "Domownicy zaproszeni"
            : "Zaproś domowników — formularz „Zaproś użytkownika” poniżej"}
        </span>
      </div>

      <div style={itemStyle}>
        <span aria-hidden>{shared.every((s) => s.ref) ? "✅" : "▢"}</span>
        <span>
          Wspólne zasoby:{" "}
          {shared.map((s, i) => (
            <span key={s.label}>
              {i > 0 && " · "}
              {s.ref ? (
                <Link href={s.href(s.ref.id)} style={linkStyle}>
                  {s.ref.name}
                </Link>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>{s.label} (brak)</span>
              )}
            </span>
          ))}
        </span>
      </div>
    </section>
  )
}
