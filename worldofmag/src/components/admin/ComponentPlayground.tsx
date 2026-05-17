"use client";

import { useState } from "react";
import { Mic, Wand2, ChevronRight } from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";

interface ComponentDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const COMPONENTS: ComponentDef[] = [
  {
    id: "smart-textarea",
    name: "SmartTextarea",
    description: "Textarea z rozpoznawaniem mowy i modyfikacją głosową przez LLM",
    icon: <Mic size={16} />,
  },
];

const SMART_TEXTAREA_PROPS = [
  { name: "value", type: "string", required: true, description: "Aktualna wartość tekstowa" },
  { name: "onChange", type: "(value: string) => void", required: true, description: "Callback przy zmianie wartości" },
  { name: "placeholder", type: "string", required: false, description: "Placeholder w polu" },
  { name: "rows", type: "number", required: false, description: "Liczba wierszy (domyślnie: 4)" },
  { name: "onSubmit", type: "() => void", required: false, description: "Wywoływane przy Ctrl+Enter" },
  { name: "disabled", type: "boolean", required: false, description: "Wyłączenie pola" },
];

const CODE_SNIPPET = `import { SmartTextarea } from "@/components/ui/SmartTextarea";

function MyComponent() {
  const [text, setText] = useState("");

  return (
    <SmartTextarea
      value={text}
      onChange={setText}
      placeholder="Wpisz lub dyktuj tekst..."
      rows={4}
      onSubmit={() => console.log("Submit:", text)}
    />
  );
}`;

export function ComponentPlayground() {
  const [activeId, setActiveId] = useState("smart-textarea");
  const [demoValue, setDemoValue] = useState("");

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface)",
          overflowY: "auto",
          padding: "8px 0",
        }}
        className="hidden md:block"
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            padding: "8px 16px",
          }}
        >
          Komponenty
        </p>
        {COMPONENTS.map((comp) => (
          <button
            key={comp.id}
            onClick={() => setActiveId(comp.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: activeId === comp.id ? "var(--bg-elevated)" : "transparent",
              border: "none",
              borderLeft: `3px solid ${activeId === comp.id ? "var(--accent-purple)" : "transparent"}`,
              color: activeId === comp.id ? "var(--text-primary)" : "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>{comp.icon}</span>
            {comp.name}
            {activeId === comp.id && (
              <ChevronRight size={12} style={{ marginLeft: "auto", color: "var(--text-muted)" }} />
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {activeId === "smart-textarea" && (
          <div style={{ maxWidth: 680 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Mic size={18} style={{ color: "var(--accent-purple)" }} />
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  SmartTextarea
                </h2>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                Textarea z wbudowanym rozpoznawaniem mowy (Web Speech API) i modyfikacją tekstu głosową przez LLM.
              </p>
            </div>

            {/* Stany */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                Stany UX
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { icon: <Mic size={13} />, state: "idle", label: "Spoczynek — przycisk 🎙 (dyktuj) i 🪄 (modyfikuj głosem)", color: "var(--text-muted)" },
                  { icon: <Mic size={13} />, state: "recording", label: "Dyktowanie — czerwony pulsujący MicOff, podgląd transkrypcji", color: "var(--accent-red)" },
                  { icon: <Wand2 size={13} />, state: "voice_modify", label: "Modyfikacja — bursztynowy pulsujący, użytkownik mówi instrukcję", color: "var(--accent-amber)" },
                  { icon: <Wand2 size={13} />, state: "processing_modify", label: "Przetwarzanie — LLM rewrituje tekst wg instrukcji głosowej", color: "var(--accent-blue)" },
                ].map((s) => (
                  <div key={s.state} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: s.color, flexShrink: 0 }}>{s.icon}</span>
                    <code style={{ fontSize: 11, background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4, color: s.color, flexShrink: 0 }}>{s.state}</code>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live demo */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                Demo interaktywne
              </h3>
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                }}
              >
                <SmartTextarea
                  value={demoValue}
                  onChange={setDemoValue}
                  placeholder="Wpisz tekst lub użyj mikrofonu… Możesz też powiedzieć 'zmień psa na kota' używając przycisku 🪄"
                  rows={5}
                />
                {demoValue && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                    Długość: {demoValue.length} znaków
                  </p>
                )}
              </div>
            </div>

            {/* Props table */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                Props
              </h3>
              <div
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                {SMART_TEXTAREA_PROPS.map((prop, i) => (
                  <div
                    key={prop.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 200px 1fr",
                      gap: 12,
                      padding: "10px 14px",
                      borderBottom: i < SMART_TEXTAREA_PROPS.length - 1 ? "1px solid var(--border)" : undefined,
                      alignItems: "start",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <code style={{ fontSize: 12, color: "var(--accent-blue)" }}>{prop.name}</code>
                      {prop.required && (
                        <span style={{ fontSize: 9, color: "var(--accent-red)", fontWeight: 700 }}>*</span>
                      )}
                    </div>
                    <code style={{ fontSize: 11, color: "var(--text-secondary)" }}>{prop.type}</code>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{prop.description}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>* wymagane</p>
            </div>

            {/* Code snippet */}
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                Kod przykładowy
              </h3>
              <pre
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "16px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  overflowX: "auto",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                <code>{CODE_SNIPPET}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
