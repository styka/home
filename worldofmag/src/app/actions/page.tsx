import { getMyActions, getActionComponents } from "@/actions/actions"
import { getMyTeams } from "@/actions/teams"
import { ActionCard } from "@/components/actions/ActionCard"
import { CreateActionForm } from "@/components/actions/CreateActionForm"

export default async function ActionsPage() {
  const [actions, components, teams] = await Promise.all([
    getMyActions(),
    getActionComponents(),
    getMyTeams(),
  ])

  const active = actions.filter((a) => a.status === "ACTIVE" || a.status === "IN_PROGRESS")
  const done = actions.filter((a) => a.status === "DONE")
  const archived = actions.filter((a) => a.status === "ARCHIVED")

  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name }))

  return (
    <div style={{ padding: "32px", maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 600 }}>
          Quick Actions
        </h1>
        <CreateActionForm components={components} teams={teamOptions} />
      </div>

      {actions.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Nie masz jeszcze żadnych akcji. Utwórz pierwszą klikając &quot;+ Nowa akcja&quot;.
        </p>
      )}

      {active.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Aktywne ({active.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {active.map((a) => <ActionCard key={a.id} action={a} />)}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Gotowe ({done.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {done.map((a) => <ActionCard key={a.id} action={a} />)}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Archiwum ({archived.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.6 }}>
            {archived.map((a) => <ActionCard key={a.id} action={a} />)}
          </div>
        </section>
      )}
    </div>
  )
}
