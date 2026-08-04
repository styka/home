"use client";

import { Field as SharedField } from "@/components/ui/Field";

// Z-110/Z-114: cienki re-eksport wspólnego, dostępnego prymitywu modalu.
// Wcześniej był to lokalny modal bez pułapki focusu i atrybutów ARIA — teraz
// deleguje do `ui/Modal` (Radix Dialog), więc wszystkie modale Pets dostają
// pułapkę focusu, role/aria-modal, blokadę scrolla i przywrócenie focusu bez
// zmian w miejscach wywołań. API (title/onClose/children/footer/wide) bez zmian.
export { Modal } from "@/components/ui/Modal";

// ─── Reużywalne pola formularzy (spójny dark-theme) ─────────────────────────

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 4,
  display: "block",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
};

/**
 * 045 — cienka nakładka na wspólne `Field` z `components/ui`.
 *
 * Moduł Zwierząt miał własne pole formularza, które robiło mniej niż wspólne: wiązało
 * etykietę z kontrolką tylko przez zagnieżdżenie w `<label>`, bez `id`, więc podpowiedź
 * i komunikat błędu nie miały się do czego podpiąć przez `aria-describedby`.
 *
 * Sygnatura zostaje bez zmian (label + children), żeby nie przepisywać kilkunastu
 * formularzy — ale implementacja jest już jedna dla całej aplikacji.
 */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <SharedField label={label}>{() => children}</SharedField>;
}

export function PrimaryButton({ children, onClick, disabled, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: "none",
        background: disabled ? "var(--bg-elevated)" : "var(--accent-orange)",
        color: disabled ? "var(--text-muted)" : "#fff",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text-secondary)",
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
