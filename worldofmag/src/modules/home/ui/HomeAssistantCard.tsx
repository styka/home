"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { openAssistant } from "@/platform/ai/assistantBus";
import type { AssistantStarter } from "@/lib/ai/assistantStarters";

interface HomeAssistantCardProps {
  /** Akcje dobrane do danych użytkownika — ze wspólnego katalogu `lib/ai/assistantStarters`. */
  starters: AssistantStarter[];
}

/**
 * 043: widget asystenta na pulpicie — zastępuje dokowaną kolumnę z 042 (`HomeAssistantColumn`).
 *
 * Trzy rzeczy wynikają wprost ze zgłoszenia właściciela i nie są tu przypadkiem:
 *
 *  1. **Zero pola tekstowego** (AC-15). Pisanie zostaje w panelu asystenta; tutaj są tylko gotowe
 *     akcje. Kolumna z 042 miała `textarea` i właściciel powiedział wprost, że go tam nie chce.
 *  2. **Widoczny na każdej szerokości** (AC-13). Poprzednik był pod `hidden xl:block`, więc na
 *     telefonie nie istniał — a to telefon jest głównym urządzeniem.
 *  3. **Klik = natychmiastowe uruchomienie** (AC-16). `openAssistant({ prompt })` otwiera panel
 *     i od razu wysyła wiadomość (okablowanie z 042), więc użytkownik nic nie przepisuje.
 *
 * Karta jest celowo NISKA — stoi pierwsza na pulpicie, więc każdy jej piksel spycha briefing
 * poniżej zgięcia na telefonie.
 */
export function HomeAssistantCard({ starters }: HomeAssistantCardProps) {
  return (
    <section
      aria-label="Asystent AI"
      data-omnia-assistant-widget
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        borderRadius: "var(--radius-lg, 12px)",
        border: "1px solid var(--border)",
        // Poświata liczona z tokenu akcentu przez color-mix — czytelna na skórce ciemnej i jasnej
        // (C-30). Zero wartości dobranych „na oko pod ciemne tło".
        background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-blue) 9%, var(--bg-surface)), var(--bg-surface))",
        boxShadow: "0 1px 3px color-mix(in srgb, var(--accent-blue) 14%, transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--accent-blue)", color: "var(--on-accent)",
            boxShadow: "0 0 16px color-mix(in srgb, var(--accent-blue) 45%, transparent)",
            flexShrink: 0,
          }}
        >
          <Sparkles size={17} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Asystent</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Wybierz gotową akcję albo otwórz rozmowę</div>
        </div>
        <button
          onClick={() => openAssistant()}
          title="Otwórz asystenta"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
            minHeight: 32, padding: "0 11px", fontSize: 12, fontWeight: 600,
            borderRadius: "var(--radius, 8px)", border: "none",
            background: "var(--accent-blue)", color: "var(--on-accent)", cursor: "pointer",
          }}
        >
          Otwórz asystenta
          <ArrowRight size={13} />
        </button>
      </div>

      {starters.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {starters.map((s) => (
            <button
              key={s.id}
              onClick={() => openAssistant({ prompt: s.prompt })}
              title={s.prompt}
              style={{
                minHeight: 32, padding: "0 10px", fontSize: 12,
                borderRadius: 999, border: "1px solid var(--border)",
                background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
