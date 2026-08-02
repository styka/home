"use client";

import { useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";
import { openAssistant } from "@/lib/ai/assistantBus";

interface HomeAssistantColumnProps {
  /** Podpowiedzi startowe dobrane do tego, co użytkownik faktycznie ma w danych. */
  starters: string[];
}

/**
 * 042: dokowana kolumna asystenta na stronie głównej (AC-11).
 *
 * To jest WYŁĄCZNIE pole wejściowe — cały stan rozmowy, historia, plany akcji i lektor
 * zostają w `AICommandSheet`. Wysłanie pytania otwiera ten panel z gotową wiadomością przez
 * magistralę zdarzeń. Powód jest praktyczny: `AICommandSheet` ma ~2,5 tys. linii i jedynego
 * właściciela stanu rozmowy; zduplikowanie go „w wariancie dokowanym" oznaczałoby dwa wątki
 * czatu i dwa źródła prawdy (C-53).
 *
 * Świadomie BEZ autofokusa: na desktopie automatyczne ustawienie kursora w tym polu
 * przewijałoby stronę do kolumny i przechwytywało skróty klawiszowe aplikacji. Pole jest
 * widoczne i gotowe do pisania po jednym kliknięciu w nie — a nie po szukaniu przycisku.
 */
export function HomeAssistantColumn({ starters }: HomeAssistantColumnProps) {
  const [text, setText] = useState("");

  function send(value: string) {
    const prompt = value.trim();
    if (!prompt) return;
    setText("");
    openAssistant({ prompt });
  }

  return (
    <aside
      aria-label="Asystent AI"
      style={{
        position: "sticky",
        top: 0,
        alignSelf: "start",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: "var(--radius-lg, 12px)",
        border: "1px solid var(--border)",
        // Poświata liczona z tokenu akcentu przez color-mix — czytelna zarówno na skórce
        // ciemnej, jak i jasnej (C-30). Zero wartości dobranych „na oko pod ciemne tło".
        background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-blue) 9%, var(--bg-surface)), var(--bg-surface))",
        boxShadow: "0 1px 3px color-mix(in srgb, var(--accent-blue) 14%, transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, borderRadius: "50%",
            background: "var(--accent-blue)", color: "var(--on-accent)",
            boxShadow: "0 0 16px color-mix(in srgb, var(--accent-blue) 45%, transparent)",
            flexShrink: 0,
          }}
        >
          <Sparkles size={18} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Asystent</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Zapytaj o cokolwiek w Omnii</div>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); }
          }}
          rows={3}
          placeholder="Napisz pytanie albo polecenie…"
          aria-label="Pytanie do asystenta"
          className="w-full text-sm focus:outline-none resize-none"
          style={{
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius, 8px)",
            padding: "9px 38px 9px 10px",
            color: "var(--text-primary)",
            lineHeight: 1.5,
            caretColor: "var(--accent-blue)",
          }}
        />
        <button
          onClick={() => send(text)}
          disabled={!text.trim()}
          aria-label="Wyślij do asystenta"
          title="Wyślij (Enter)"
          style={{
            position: "absolute", right: 7, bottom: 9,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 7, border: "none",
            background: text.trim() ? "var(--accent-blue)" : "var(--bg-elevated)",
            color: text.trim() ? "var(--on-accent)" : "var(--text-muted)",
            cursor: text.trim() ? "pointer" : "default",
          }}
        >
          <ArrowUp size={14} />
        </button>
      </div>

      {starters.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {starters.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              style={{
                textAlign: "left", fontSize: 12, padding: "7px 9px",
                borderRadius: "var(--radius, 8px)", border: "1px solid var(--border)",
                background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
