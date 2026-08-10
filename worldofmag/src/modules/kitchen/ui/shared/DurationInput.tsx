"use client";

import { useEffect, useState } from "react";

type Unit = "min" | "h";

interface DurationInputProps {
  value: number | null;       // wartość zewnętrzna w minutach
  onChange: (minutes: number | null) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Input czasu: liczbowy + dropdown jednostki (min / h).
 * Wartość zewnętrzna zawsze w minutach. Dla wartości ≥ 60 i podzielnej przez 60
 * wybiera domyślnie jednostkę "h"; w innych przypadkach "min".
 */
export function DurationInput({ value, onChange, placeholder, ariaLabel }: DurationInputProps) {
  const [unit, setUnit] = useState<Unit>(() => initialUnit(value));
  const [local, setLocal] = useState<string>(() => initialLocal(value, initialUnit(value)));

  // Sync z zewnętrznym value (np. reset formularza)
  useEffect(() => {
    setLocal(initialLocal(value, unit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(nextLocal: string, nextUnit: Unit) {
    if (nextLocal === "") {
      onChange(null);
      return;
    }
    const n = Number(nextLocal);
    if (Number.isNaN(n) || n < 0) {
      onChange(null);
      return;
    }
    onChange(nextUnit === "h" ? Math.round(n * 60) : Math.round(n));
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        step={unit === "h" ? "0.25" : "1"}
        value={local}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => {
          setLocal(e.target.value);
          commit(e.target.value, unit);
        }}
        className="flex-1 min-w-0 px-2 py-1.5 rounded border text-sm"
        style={{
          backgroundColor: "var(--bg-elevated)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      />
      <select
        value={unit}
        onChange={(e) => {
          const next = e.target.value as Unit;
          setUnit(next);
          // Konwersja wyświetlanej wartości na nową jednostkę, by user widział spójność
          if (value != null) {
            setLocal(next === "h" ? String(Math.round((value / 60) * 100) / 100) : String(value));
          }
        }}
        className="px-1.5 py-1.5 rounded border text-xs"
        style={{
          backgroundColor: "var(--bg-elevated)",
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
        }}
        aria-label="Jednostka czasu"
      >
        <option value="min">min</option>
        <option value="h">h</option>
      </select>
    </div>
  );
}

function initialUnit(value: number | null): Unit {
  if (value != null && value >= 60 && value % 60 === 0) return "h";
  return "min";
}

function initialLocal(value: number | null, unit: Unit): string {
  if (value == null) return "";
  if (unit === "h") return String(Math.round((value / 60) * 100) / 100);
  return String(value);
}
