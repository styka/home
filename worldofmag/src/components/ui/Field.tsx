"use client";

import { useId, type ReactNode } from "react";

/**
 * 045 — pole formularza: etykieta, podpowiedź, błąd, wymagalność.
 *
 * Formularze w Omnii były pisane od zera w każdym module, więc komunikat błędu bywał
 * pod polem, obok pola, albo w toaście — a etykieta czasem nie była z polem powiązana,
 * co dla czytnika ekranu znaczy „pole bez nazwy".
 *
 * `Field` rozwiązuje to jednym mechanizmem: generuje `id`, wiąże `<label htmlFor>`,
 * a podpowiedź i błąd podpina przez `aria-describedby`. Dziecko dostaje te atrybuty
 * jako funkcja — dzięki temu działa z `<input>`, `<select>`, `<textarea>` i
 * `SmartTextarea` bez wariantu na każdy z nich.
 */

export interface FieldChildProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (props: FieldChildProps) => ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "flex", gap: 4 }}
      >
        {label}
        {required && (
          <span aria-hidden style={{ color: "var(--accent-red)" }}>
            *
          </span>
        )}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })}

      {hint && !error && (
        <p id={hintId} style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
          {hint}
        </p>
      )}

      {/* `role="alert"` — błąd, który pojawia się po walidacji, musi zostać ogłoszony,
          a nie tylko wyświetlony. */}
      {error && (
        <p id={errorId} role="alert" style={{ fontSize: 11, color: "var(--accent-red)", margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Wspólny styl kontrolki — żeby pola w różnych modułach nie różniły się wysokością. */
export const fieldControlStyle: React.CSSProperties = {
  minHeight: "var(--control-height)",
  padding: "8px 10px",
  borderRadius: "var(--radius-control)",
  border: "var(--border-width) var(--border-style) var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  fontSize: 14,
  width: "100%",
};
