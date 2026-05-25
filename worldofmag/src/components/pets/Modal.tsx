"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full md:mx-4"
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
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
          <button
            onClick={onClose}
            style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
            aria-label="Zamknij"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
        {footer && (
          <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
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
