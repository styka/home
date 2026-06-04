"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";

// Poranny briefing na żądanie. Świadomie NIE generujemy automatycznie przy
// każdym wejściu (koszt/latencja LLM + cold-start) — użytkownik klika „Wygeneruj",
// a wynik cache'ujemy w localStorage na bieżący dzień (jeden briefing dziennie).
const CACHE_KEY = "omnia.dailyBriefing";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyBriefingCard() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wczytaj cache, jeśli jest z dzisiaj.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { date, text } = JSON.parse(raw) as { date: string; text: string };
        if (date === todayKey() && text) setBriefing(text);
      }
    } catch { /* ignore */ }
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/llm/home/briefing", { method: "POST" });
      const data = (await res.json()) as { briefing?: string; error?: string };
      if (!res.ok || !data.briefing) {
        setError(data.error ?? "Nie udało się wygenerować briefingu");
        return;
      }
      setBriefing(data.briefing);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayKey(), text: data.briefing })); } catch { /* ignore */ }
    } catch {
      setError("Nie udało się połączyć z asystentem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <style>{MARKDOWN_STYLES}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} style={{ color: "var(--accent-blue)" }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Briefing dnia</h2>
        </div>
        {briefing && !loading && (
          <button
            onClick={generate}
            title="Odśwież briefing"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <RefreshCw size={12} /> Odśwież
          </button>
        )}
      </div>

      {briefing ? (
        <div
          style={{ marginTop: 10, fontSize: 13.5, color: "var(--text-secondary)" }}
          dangerouslySetInnerHTML={{ __html: markdownToHtml(briefing) }}
        />
      ) : (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
            Krótkie podsumowanie dnia — zaległości, dzisiejsze terminy i najbliższe wydarzenia w jednym miejscu.
          </p>
          <button
            onClick={generate}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: loading ? "var(--bg-elevated)" : "var(--accent-blue)",
              color: loading ? "var(--text-muted)" : "#fff", cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? "Generuję…" : "Wygeneruj briefing"}
          </button>
        </div>
      )}

      {error && <p style={{ marginTop: 8, fontSize: 12, color: "var(--accent-red)" }}>{error}</p>}
    </div>
  );
}
