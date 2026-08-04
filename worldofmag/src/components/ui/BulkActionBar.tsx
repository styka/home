"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * 045 — pasek akcji zbiorczych. Wzorzec wyprowadzony z Zadań, jedynego modułu, który
 * go dotąd miał (rozdz. 10.6: „akcje zbiorcze — dziś tylko Zadania → wspólny `BulkActionBar`").
 *
 * Pływa nad treścią zamiast wypychać układ: pasek pojawiający się i znikający wraz
 * z zaznaczeniem przeskakiwałby listą przy każdym kliknięciu.
 *
 * Respektuje `env(safe-area-inset-bottom)` i na telefonie siada NAD dolnym paskiem
 * nawigacji (56 px), a nie pod nim — inaczej byłby zasłonięty dokładnie tam, gdzie
 * zaznacza się palcem.
 */

export interface BulkActionBarProps {
  count: number;
  /** Odmiana rzeczownika: [1, 2–4, 5+] — np. ["pozycja","pozycje","pozycji"]. */
  noun?: [string, string, string];
  onClear: () => void;
  children: ReactNode;
}

/** Polska odmiana liczebnika. „5 zadań", nie „5 zadanie". */
function plural(n: number, [one, few, many]: [string, string, string]): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

export function BulkActionBar({
  count,
  noun = ["pozycja", "pozycje", "pozycji"],
  onClear,
  children,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Akcje zbiorcze"
      className="fixed left-1/2 z-40"
      style={{
        transform: "translateX(-50%)",
        bottom: "calc(56px + 12px + env(safe-area-inset-bottom))",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px 8px 14px",
        borderRadius: "var(--radius-pill)",
        background: "var(--bg-elevated)",
        border: "var(--border-width) var(--border-style) var(--border)",
        boxShadow: "var(--shadow-elevated)",
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
        {count} {plural(count, noun)}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>{children}</div>

      <button
        type="button"
        onClick={onClear}
        aria-label="Wyczyść zaznaczenie"
        title="Wyczyść zaznaczenie"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "var(--radius-pill)",
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
