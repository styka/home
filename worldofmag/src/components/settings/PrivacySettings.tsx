"use client";

import { useState } from "react";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { exportMyData } from "@/actions/privacy";

// Z-050 (RODO art. 15/20): panel prywatności w Ustawieniach. „Pobierz moje dane"
// woła Server Action zbierający komplet danych użytkownika i zapisuje je jako plik
// JSON po stronie przeglądarki (bez wysyłania nigdzie indziej).
export function PrivacySettings() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `omnia-moje-dane-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przygotować eksportu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ShieldCheck size={22} style={{ color: "var(--text-secondary)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>Pobierz moje dane</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Komplet Twoich danych ze wszystkich modułów w formacie JSON (RODO art. 15/20).
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleExport}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "var(--accent-blue)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--on-accent)",
            fontSize: 13,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy ? "Przygotowuję…" : "Pobierz JSON"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "var(--accent-red)", fontSize: 12, margin: 0 }}>{error}</p>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          Eksport obejmuje dane, których jesteś właścicielem. Dane zespołów oraz sekrety logowania
          (tokeny) nie są zawarte.
        </p>
      )}
    </div>
  );
}
