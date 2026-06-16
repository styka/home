"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Loader2 } from "lucide-react";
import { getHealthSettings, setHealthAiOptIn } from "@/actions/health";

// Z-270: przełącznik zgody na dostęp asystenta AI do danych zdrowotnych.
// Samowystarczalny (sam pobiera stan). Domyślnie wyłączone (privacy-by-default).
export function HealthAiOptInToggle() {
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getHealthSettings()
      .then((s) => setOptIn(s.aiOptIn))
      .catch(() => setOptIn(false));
  }, []);

  if (optIn === null) return null;

  function toggle() {
    const next = !optIn;
    setOptIn(next);
    startTransition(async () => {
      try {
        await setHealthAiOptIn(next);
      } catch {
        setOptIn(!next);
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <Bot size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>Dostęp asystenta AI do danych zdrowotnych</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Domyślnie wyłączone. Po włączeniu asystent może czytać Twoje wizyty, badania i leki.
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        role="switch"
        aria-checked={optIn}
        aria-label="Dostęp AI do danych zdrowotnych"
        style={{
          position: "relative", width: 42, height: 24, flexShrink: 0, borderRadius: 999,
          border: "1px solid var(--border)", cursor: pending ? "default" : "pointer",
          background: optIn ? "var(--accent-green)" : "var(--bg-elevated)", transition: "background 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute", top: 2, left: optIn ? 20 : 2, width: 18, height: 18, borderRadius: "50%",
            background: "var(--on-accent, #fff)", transition: "left 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {pending ? <Loader2 size={11} className="animate-spin" style={{ color: "var(--text-muted)" }} /> : null}
        </span>
      </button>
    </div>
  );
}
