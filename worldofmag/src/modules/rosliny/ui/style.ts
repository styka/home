import type { CSSProperties } from "react";

/**
 * 113 — wspólne style widoków modułu.
 *
 * **Wyłącznie zmienne CSS** (C-30): skórka może nadpisać każdą z nich, a zaszyty heks łamie
 * skinowalność i dodatkowo zażądałby zadeklarowania roli koloru w bramce kontraktu widoku.
 * Na kolorowych tłach tekst bierzemy z `--on-accent`, nie z bieli.
 */

export const przycisk: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 8,
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  fontSize: 13,
  border: "1px solid var(--border)",
  cursor: "pointer",
  // C-31: minimalny cel dotyku. Przyciski w tym module stoją gęsto obok siebie na telefonie.
  minHeight: 40,
  // 118 (zgł. 5/8/9): ikona i etykieta stoją OBOK siebie i nigdy się nie rozłamują — w ciasnym
  // rzędzie tekst łamał się pod ikonę („Usuń przestrzeń", „+ Nowa przestrzeń"). Flex zamiast
  // `verticalAlign` na każdej ikonie z osobna; zawija się cały przycisk, nie jego wnętrze.
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

export const przyciskGlowny: CSSProperties = {
  ...przycisk,
  background: "var(--accent-green)",
  color: "var(--on-accent)",
  borderColor: "transparent",
  fontWeight: 600,
};

export const sekcja: CSSProperties = {
  padding: 14,
  borderRadius: 10,
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  marginBottom: 12,
};

export const naglowekSekcji: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
  margin: "0 0 8px",
  // 118 (zgł. 3): nagłówek z ikoną („POMIARY") łamał tekst POD ikonę. Flex trzyma ikonę we
  // własnej kolumnie — dłuższy tytuł zawija się we własnym polu, nigdy pod ikoną.
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export const pole: CSSProperties = {
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
  minHeight: 40,
};

export const drobny: CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
};

/** Kolor akcentu dla stanu pozycji agendy — zaległe wołają mocniej niż nadchodzące. */
export function kolorKubelka(bucket: "OVERDUE" | "TODAY" | "SOON"): string {
  if (bucket === "OVERDUE") return "var(--accent-red)";
  if (bucket === "TODAY") return "var(--accent-amber)";
  return "var(--accent-green)";
}
