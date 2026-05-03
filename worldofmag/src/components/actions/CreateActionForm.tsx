"use client"

import { useState, useTransition } from "react"
import { createAction } from "@/actions/actions"

interface ActionComponent {
  id: string
  name: string
  type: string
  description: string | null
  defaultParams: string | null
}

interface Team {
  id: string
  name: string
}

interface Props {
  components: ActionComponent[]
  teams: Team[]
}

export function CreateActionForm({ components, teams }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const title = (fd.get("title") as string).trim()
    const componentId = fd.get("componentId") as string
    const description = (fd.get("description") as string).trim() || undefined
    const dueDate = fd.get("dueDate") as string || undefined
    const ownerTeamId = fd.get("ownerTeamId") as string || undefined
    const customUrl = (fd.get("customUrl") as string).trim() || undefined
    const customLabel = (fd.get("customLabel") as string).trim() || undefined

    if (!title || !componentId) { setError("Tytuł i komponent są wymagane."); return }

    const component = components.find((c) => c.id === componentId)
    let params: string | undefined
    if (component?.type === "LINK_BUTTON" && customUrl) {
      params = JSON.stringify({ url: customUrl, label: customLabel || customUrl })
    }

    setError("")
    startTransition(async () => {
      try {
        await createAction({ title, description, componentId, params, dueDate, ownerTeamId })
        setOpen(false)
        ;(e.target as HTMLFormElement).reset()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd")
      }
    })
  }

  const [selectedComponent, setSelectedComponent] = useState(components[0]?.id ?? "")
  const componentType = components.find((c) => c.id === selectedComponent)?.type

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "8px 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text-primary)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        + Nowa akcja
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <input
          name="title"
          placeholder="Tytuł akcji"
          required
          autoFocus
          style={inputStyle}
        />
        <select
          name="componentId"
          value={selectedComponent}
          onChange={(e) => setSelectedComponent(e.target.value)}
          style={inputStyle}
        >
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {componentType === "LINK_BUTTON" && (
        <div style={{ display: "flex", gap: 8 }}>
          <input name="customUrl" placeholder="URL (opcjonalnie — nadpisuje domyślny)" style={inputStyle} />
          <input name="customLabel" placeholder="Etykieta przycisku" style={{ ...inputStyle, flex: "0 0 180px" }} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input name="description" placeholder="Opis (opcjonalnie)" style={inputStyle} />
        <input name="dueDate" type="date" style={{ ...inputStyle, flex: "0 0 160px" }} />
      </div>

      {teams.length > 0 && (
        <select name="ownerTeamId" style={inputStyle}>
          <option value="">Moja przestrzeń</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={isPending} style={btnPrimaryStyle}>
          {isPending ? "Tworzę…" : "Utwórz"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={btnSecondaryStyle}>
          Anuluj
        </button>
      </div>
    </form>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 13,
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "var(--accent-purple, #7c3aed)",
  border: "none",
  borderRadius: 6,
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-secondary)",
  fontSize: 13,
  cursor: "pointer",
}
