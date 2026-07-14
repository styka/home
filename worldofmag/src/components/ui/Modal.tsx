"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  /** Sterowanie widocznością. Pominięte = otwarty póki zamontowany (wzorzec `{show && <Modal/>}`). */
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Szerszy modal (640px zamiast 480px). */
  wide?: boolean;
  /** Ukryj domyślny przycisk „X" w nagłówku. */
  hideClose?: boolean;
  className?: string;
}

/**
 * Z-110 / Z-114 — jeden dostępny prymityw modalu (na Radix Dialog).
 *
 * Radix daje za darmo to, czego brakowało modalom ad-hoc w repo:
 *  - pułapkę focusu (Tab krąży w modalu) + przywrócenie focusu po zamknięciu,
 *  - `role="dialog"` + `aria-modal` + `aria-labelledby` (tytuł),
 *  - obsługę Esc i kliknięcia w tło,
 *  - blokadę scrolla tła.
 *
 * Wygląd (mobilny bottom-sheet z uchwytem, desktop wyśrodkowany, dark-theme)
 * jest zgodny z dotychczasowym stylem modali aplikacji.
 */
export function Modal({ open = true, onClose, title, children, footer, wide, hideClose, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <Dialog.Content
            aria-describedby={undefined}
            className={cn("w-full md:mx-4", className)}
            style={{
              maxWidth: wide ? 640 : 480,
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px 16px 0 0",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
            </div>
            <div
              className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <Dialog.Title asChild>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
              </Dialog.Title>
              {!hideClose && (
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Zamknij"
                    style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                  >
                    <X size={16} />
                  </button>
                </Dialog.Close>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {children}
            </div>
            {footer && (
              <div
                className="px-5 py-3 flex-shrink-0"
                style={{ borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                {footer}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
