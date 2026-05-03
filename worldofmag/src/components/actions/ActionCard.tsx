"use client"

import { useState, useTransition } from "react"
import { updateActionStatus, deleteAction } from "@/actions/actions"
import { WeatherWidget } from "./WeatherWidget"
import type { ActionStatus } from "@/types"

interface Component {
  id: string
  name: string
  type: string
  defaultParams: string | null
}

interface ActionCardProps {
  action: {
    id: string
    title: string
    description: string | null
    status: string
    dueDate: Date | null
    nextDueDate: Date | null
    isRecurring: boolean
    recurPattern: string | null
    params: string | null
    ownerTeam: { id: string; name: string } | null
    component: Component
  }
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktywna",
  IN_PROGRESS: "W toku",
  DONE: "Gotowe",
  ARCHIVED: "Archiwum",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  DONE: "#22c55e",
  ARCHIVED: "#6b7280",
}

export function ActionCard({ action }: ActionCardProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState(action.status as ActionStatus)

  const params = action.params ? JSON.parse(action.params) : null
  const defaultParams = action.component.defaultParams
    ? JSON.parse(action.component.defaultParams)
    : null
  const url = params?.url ?? defaultParams?.url
  const label = params?.label ?? defaultParams?.label ?? action.component.name

  function cycleStatus() {
    const cycle: ActionStatus[] = ["ACTIVE", "IN_PROGRESS", "DONE"]
    const next = cycle[(cycle.indexOf(status) + 1) % cycle.length]
    setStatus(next)
    startTransition(() => updateActionStatus(action.id, next))
  }

  function handleDelete() {
    if (!confirm(`Usunąć akcję "${action.title}"?`)) return
    startTransition(() => deleteAction(action.id))
  }

  const dueLabel = action.isRecurring && action.nextDueDate
    ? `↻ ${new Date(action.nextDueDate).toLocaleDateString("pl-PL")}`
    : action.dueDate
    ? new Date(action.dueDate).toLocaleDateString("pl-PL")
    : null

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "16px 20px",
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 150ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Status dot — click to cycle */}
        <button
          onClick={cycleStatus}
          title={`Status: ${STATUS_LABELS[status]} — kliknij aby zmienić`}
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: STATUS_COLORS[status] ?? "#6b7280",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            marginTop: 3,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: 14 }}>
              {action.title}
            </span>
            {action.ownerTeam && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                {action.ownerTeam.name}
              </span>
            )}
            {dueLabel && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{dueLabel}</span>
            )}
          </div>

          {action.description && (
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0" }}>
              {action.description}
            </p>
          )}

          {/* Component widget */}
          <div style={{ marginTop: 12 }}>
            {action.component.type === "LINK_BUTTON" && url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "6px 14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                {label} ↗
              </a>
            )}
            {action.component.type === "WEATHER_GENERATOR" && <WeatherWidget />}
          </div>
        </div>

        <button
          onClick={handleDelete}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 16,
            padding: 4,
            flexShrink: 0,
          }}
          title="Usuń"
        >
          ×
        </button>
      </div>
    </div>
  )
}
