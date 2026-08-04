"use client";

import type { ControlValues, PlaygroundControl } from "@/lib/ui/playground/registry";

/**
 * 045 — sterowanie właściwościami komponentu na żywo.
 *
 * Bez tego playground jest katalogiem zrzutów ekranu. Z tym można sprawdzić, jak
 * komponent zachowa się w przypadku, który akurat nas interesuje — np. czy przycisk
 * z bardzo długą etykietą rozpycha układ, zanim wstawimy go do modułu.
 */
export function PlaygroundControls({
  controls,
  values,
  onChange,
}: {
  controls: PlaygroundControl[];
  values: ControlValues;
  onChange: (v: ControlValues) => void;
}) {
  function set(key: string, value: string | number | boolean) {
    onChange({ ...values, [key]: value });
  }

  const inputStyle: React.CSSProperties = {
    minHeight: 36,
    padding: "6px 8px",
    borderRadius: "var(--radius-control)",
    border: "var(--border-width) var(--border-style) var(--border)",
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    fontSize: 13,
    width: "100%",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        padding: 12,
        borderRadius: "var(--radius-lg)",
        border: "var(--border-width) var(--border-style) var(--border)",
        background: "var(--bg-elevated)",
      }}
    >
      {controls.map((control) => {
        const value = values[control.key] ?? control.default;
        return (
          <label key={control.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{control.label}</span>

            {control.kind === "text" && (
              <input value={String(value)} onChange={(e) => set(control.key, e.target.value)} style={inputStyle} />
            )}

            {control.kind === "number" && (
              <input
                type="number"
                value={Number(value)}
                min={control.min}
                max={control.max}
                onChange={(e) => set(control.key, Number(e.target.value))}
                style={inputStyle}
              />
            )}

            {control.kind === "select" && (
              <select value={String(value)} onChange={(e) => set(control.key, e.target.value)} style={inputStyle}>
                {control.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}

            {control.kind === "boolean" && (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => set(control.key, e.target.checked)}
                // 20×20 px — minimum dotykowe (C-31).
                style={{ width: 20, height: 20, cursor: "pointer" }}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
