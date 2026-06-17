"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot } from "lucide-react";
import { getFinanceSettings, setFinanceSettings } from "@/actions/portfelAuto";

// Z-055: przełącznik dostępu asystenta AI do danych finansowych (salda/długi).
// Opt-out — domyślnie WŁĄCZONY (zachowuje dotychczasowe zachowanie); użytkownik
// może wyłączyć, by dane finansowe nie trafiały do promptu LLM. Samowystarczalny.
export function FinanceAiAccessToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getFinanceSettings()
      .then((s) => setEnabled(s.aiAccessEnabled))
      .catch(() => setEnabled(true));
  }, []);

  if (enabled === null) return null;

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await setFinanceSettings({ aiAccessEnabled: next });
      } catch {
        setEnabled(!next);
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <Bot size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>Dostęp asystenta AI do danych finansowych</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Gdy włączone, asystent może czytać Twoje salda i elementy portfela. Wyłącz, by nie trafiały do AI.
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        role="switch"
        aria-checked={enabled}
        aria-label="Dostęp AI do danych finansowych"
        style={{
          position: "relative",
          width: 42,
          height: 24,
          flexShrink: 0,
          borderRadius: 999,
          border: "none",
          cursor: pending ? "wait" : "pointer",
          background: enabled ? "var(--accent-green)" : "var(--bg-elevated)",
          transition: "background 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: enabled ? 21 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
          }}
        />
      </button>
    </div>
  );
}
