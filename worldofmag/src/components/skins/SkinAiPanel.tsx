"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import type { AiUsageInfo } from "@/lib/ai/usage";
import { SkinPreview } from "./SkinPreview";
import type { SkinTokens } from "@/lib/skins";

/**
 * 045 — „opisz, jak ma wyglądać" → komplet tokenów.
 *
 * Reguła nadrzędna: model **proponuje, nigdy nie zapisuje**. Wygenerowana skórka
 * pojawia się jako podgląd obok opisu i dopiero kliknięcie „Użyj tej propozycji"
 * wstawia tokeny do edytora — gdzie nadal można je poprawić ręcznie. Automatyczna
 * podmiana wyglądu aplikacji byłaby zaskoczeniem, nie funkcją.
 *
 * Odrzucone tokeny są POKAZYWANE. Model potrafi „pomocnie" zwrócić `url()` z obrazkiem
 * albo czcionkę z sieci; sanityzacja to wycina, ale ciche wycięcie zostawiłoby
 * użytkownika z pytaniem, czemu skórka wygląda inaczej, niż zapowiadał opis.
 */

interface GeneratedSkin {
  name: string;
  description: string;
  colorScheme: "light" | "dark";
  rationale: string;
  tokens: SkinTokens;
  rejected: string[];
}

const EXAMPLES = [
  "konsola statku kosmicznego — bursztyn i granat, wersaliki",
  "stary terminal z zielonym fosforem",
  "papier listowy, szeryfy, ciepła biel",
  "japoński minimalizm — dużo światła, jeden akcent",
];

export function SkinAiPanel({ onApply }: { onApply: (skin: GeneratedSkin) => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedSkin | null>(null);
  const [usage, setUsage] = useState<AiUsageInfo | null>(null);

  async function generate() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/llm/skins/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Nie udało się wygenerować skórki");
      setResult(data.skin as GeneratedSkin);
      setUsage((data.usage ?? null) as AiUsageInfo | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wygenerować skórki");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          alignSelf: "flex-start",
          minHeight: 40,
          padding: "0 14px",
          borderRadius: "var(--radius-control)",
          background: "var(--bg-elevated)",
          border: "var(--border-width) var(--border-style) var(--border)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Sparkles size={15} style={{ color: "var(--accent-purple)" }} />
        Opisz skórkę słowami
      </button>
    );
  }

  return (
    <div
      style={{
        borderTop: "var(--border-width) var(--border-style) var(--border)",
        paddingTop: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={15} style={{ color: "var(--accent-purple)" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Opisz skórkę słowami</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
        >
          Zwiń
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="np. konsola statku kosmicznego — bursztyn i granat, wersaliki w nagłówkach"
        style={{
          background: "var(--bg-base)",
          border: "var(--border-width) var(--border-style) var(--border)",
          borderRadius: "var(--radius-control)",
          color: "var(--text-primary)",
          padding: "8px 10px",
          fontSize: 13,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            style={{
              padding: "5px 10px",
              borderRadius: "var(--radius-pill)",
              background: "var(--bg-elevated)",
              border: "var(--border-width) var(--border-style) var(--border)",
              color: "var(--text-secondary)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={generate}
          disabled={busy || !prompt.trim()}
          style={{
            minHeight: 40,
            padding: "0 16px",
            borderRadius: "var(--radius-control)",
            background: "var(--accent-purple)",
            border: "none",
            color: "var(--on-accent)",
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            opacity: busy || !prompt.trim() ? 0.6 : 1,
          }}
        >
          {busy ? "Generuję…" : result ? "Generuj ponownie" : "Generuj"}
        </button>
        {usage && <AiCostBadge usage={usage} />}
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-red)" }}>
          <AlertTriangle size={13} />
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 220px",
            gap: 14,
            alignItems: "start",
            padding: 12,
            borderRadius: "var(--radius-lg)",
            border: "var(--border-width) var(--border-style) var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{result.name}</span>
            {result.description && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{result.description}</span>
            )}
            {result.rationale && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{result.rationale}</span>
            )}

            {result.rejected.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--accent-amber)" }}>
                Pominięto {result.rejected.length} niedozwolonych {result.rejected.length === 1 ? "token" : "tokenów"}:{" "}
                {result.rejected.slice(0, 4).join(", ")}
                {result.rejected.length > 4 ? "…" : ""}
              </span>
            )}

            <button
              type="button"
              onClick={() => onApply(result)}
              style={{
                alignSelf: "flex-start",
                minHeight: 40,
                padding: "0 16px",
                borderRadius: "var(--radius-control)",
                background: "var(--accent-blue)",
                border: "none",
                color: "var(--on-accent)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Użyj tej propozycji
            </button>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Nic nie zostało jeszcze zapisane — po wstawieniu możesz dostroić każdy token ręcznie.
            </span>
          </div>

          <SkinPreview tokens={result.tokens} />
        </div>
      )}
    </div>
  );
}
