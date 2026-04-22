"use client"

import { inviteUser } from "@/actions/invitations"
import { useState } from "react"

export default function InviteMemberForm({ teamId }: { teamId: string }) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus("loading")
    setError("")
    try {
      await inviteUser(teamId, email.trim())
      setEmail("")
      setStatus("ok")
      setTimeout(() => setStatus("idle"), 2000)
    } catch (err: any) {
      setError(err.message ?? "Błąd")
      setStatus("error")
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email użytkownika..."
        style={{
          flex: 1,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text-primary)",
          fontSize: 14,
          padding: "8px 12px",
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={status === "loading" || !email.trim()}
        style={{
          padding: "8px 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text-primary)",
          fontSize: 14,
          cursor: "pointer",
          opacity: status === "loading" ? 0.5 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {status === "loading" ? "..." : status === "ok" ? "Wysłano ✓" : "Zaproś"}
      </button>
      {status === "error" && (
        <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span>
      )}
    </form>
  )
}
