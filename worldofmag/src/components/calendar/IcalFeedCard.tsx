"use client"

import { useState } from "react"
import { getMyIcalFeedUrl, regenerateIcalFeed } from "@/actions/calendar"

/**
 * Z-150: karta subskrypcji iCal — pokazuje odwoływalny link feedu agendy do
 * wklejenia w Google/Apple Calendar, z kopiowaniem i rotacją (unieważnienie starego).
 * Link generowany leniwie na żądanie (token zakładany przy pierwszym „Pokaż").
 */
export function IcalFeedCard() {
  const [url, setUrl] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [noBase, setNoBase] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function reveal() {
    setLoading(true)
    try {
      const u = await getMyIcalFeedUrl()
      setUrl(u); setNoBase(u === null); setShown(true)
    } finally { setLoading(false) }
  }

  async function regen() {
    if (!confirm("Wygenerować nowy link subskrypcji? Stary przestanie działać.")) return
    setLoading(true)
    try {
      const u = await regenerateIcalFeed()
      setUrl(u); setNoBase(u === null); setCopied(false)
    } finally { setLoading(false) }
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { /* brak schowka — użytkownik zaznaczy ręcznie */ }
  }

  const btn: React.CSSProperties = {
    padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)",
    background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
  }

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px" }}>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 4 }}>
        Subskrybuj agendę Omnia w Google/Apple Calendar (tylko do odczytu).
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 12 }}>
        Link zawiera prywatny token — nie udostępniaj go. Możesz go w każdej chwili unieważnić.
      </p>

      {!shown ? (
        <button type="button" onClick={reveal} disabled={loading} style={btn}>
          {loading ? "…" : "Pokaż link subskrypcji"}
        </button>
      ) : noBase ? (
        <p style={{ color: "var(--accent-amber)", fontSize: 13 }}>
          Brak skonfigurowanego adresu aplikacji (AUTH_URL) — link wygeneruje się po ustawieniu go w środowisku.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            readOnly
            value={url ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 12,
              fontFamily: "monospace", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--bg-base)", color: "var(--text-secondary)",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={copy} disabled={loading} style={{ ...btn, borderColor: "var(--accent-blue)" }}>
              {copied ? "Skopiowano ✓" : "Kopiuj link"}
            </button>
            <button type="button" onClick={regen} disabled={loading} style={btn}>
              Wygeneruj nowy (unieważnij stary)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
