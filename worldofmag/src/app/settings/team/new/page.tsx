import { createTeam } from "@/actions/teams"
import { redirect } from "next/navigation"

export default function NewTeamPage() {
  return (
    <div style={{ padding: "32px", maxWidth: 480 }}>
      <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
        Nowy team
      </h1>
      <form
        action={async (formData: FormData) => {
          "use server"
          const name = formData.get("name") as string
          const description = formData.get("description") as string
          if (!name?.trim()) return
          const team = await createTeam(name.trim(), description?.trim() || undefined)
          redirect(`/settings/team/${team.id}`)
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div>
          <label style={{ color: "var(--text-secondary)", fontSize: 13, display: "block", marginBottom: 6 }}>
            Nazwa *
          </label>
          <input
            name="name"
            required
            autoFocus
            style={{
              width: "100%",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: 14,
              padding: "10px 12px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)", fontSize: 13, display: "block", marginBottom: 6 }}>
            Opis (opcjonalny)
          </label>
          <textarea
            name="description"
            rows={3}
            style={{
              width: "100%",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: 14,
              padding: "10px 12px",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Utwórz team
        </button>
      </form>
    </div>
  )
}
