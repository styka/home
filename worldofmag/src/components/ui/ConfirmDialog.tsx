"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Modal } from "./Modal";

/**
 * 045 — jedno okno potwierdzenia dla całej aplikacji.
 *
 * Dotąd każdy moduł pisał własny modal usuwania: inny układ przycisków, inna treść,
 * gdzieniegdzie `window.confirm`. Skutek był taki, że przycisk „Usuń" bywał raz po
 * lewej, raz po prawej — czyli ręka uczyła się złego odruchu.
 *
 * Stoi na istniejącym `Modal` (Radix Dialog), więc dostaje za darmo pułapkę focusu,
 * Esc, blokadę przewijania tła i `role="dialog"` — a nie odtwarza ich po raz kolejny.
 *
 * Domyślnie focus ląduje na przycisku ANULUJ, nie na potwierdzeniu. Przy akcji
 * niszczącej Enter odruchowo wciśnięty zaraz po otwarciu ma nic nie zepsuć.
 */

export interface ConfirmDialogProps {
  open?: boolean;
  title: string;
  /** Co dokładnie się stanie. Nie „Czy na pewno?", tylko „Usuniesz 3 pozycje". */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Wariant niszczący — czerwony przycisk potwierdzenia. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open = true,
  title,
  description,
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  destructive,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const buttonBase: React.CSSProperties = {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: "var(--radius-control)",
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.6 : 1,
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              ...buttonBase,
              background: "var(--bg-elevated)",
              border: "var(--border-width) var(--border-style) var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              ...buttonBase,
              background: destructive ? "var(--accent-red)" : "var(--accent-blue)",
              border: "none",
              color: "var(--on-accent)",
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {description && (
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{description}</p>
      )}
    </Modal>
  );
}
