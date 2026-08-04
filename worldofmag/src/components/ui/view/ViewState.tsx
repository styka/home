"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Lock, RotateCw } from "lucide-react";

/**
 * 045 — JEDEN zestaw stanów brzegowych dla wszystkich modułów.
 *
 * Dotąd każdy moduł rysował stan pusty po swojemu (25 wariantów `EmptyState`),
 * stan ładowania miała część, a stanu „brak dostępu" nie było wcale. To nie jest
 * kwestia estetyki, tylko kosztu: poprawka UX wymagała obejścia 21 modułów.
 *
 * Wszystkie cztery stany dzielą tę samą ramę (`StateFrame`), więc różnią się
 * wyłącznie tym, czym MAJĄ się różnić: ikoną, tonem i akcją wyjścia.
 *
 * Uwaga na lekcję z 038: stan oczekiwania i stan błędu muszą wyglądać INACZEJ.
 * Użytkownik, który widzi ten sam prostokąt dla „nic tu nie ma" i „nie udało się
 * wczytać", nie wie, czy ma coś dodać, czy odświeżyć.
 */

export type ViewStateKind = "ready" | "empty" | "loading" | "error" | "no-access";

interface StateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface StateFrameProps {
  icon: ReactNode;
  /** Kolor ikony i obwódki — zawsze token, nigdy hex (C-30). */
  tone: string;
  title: string;
  description?: string;
  action?: StateAction;
  /** Obramowanie kreskowane sygnalizuje „miejsce, które można wypełnić" (stan pusty). */
  dashed?: boolean;
  role?: "status" | "alert";
}

function StateFrame({ icon, tone, title, description, action, dashed, role }: StateFrameProps) {
  return (
    <div
      role={role}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "36px 20px",
        borderRadius: "var(--radius-lg)",
        border: `var(--border-width) ${dashed ? "dashed" : "var(--border-style)"} var(--border)`,
        background: "var(--bg-surface)",
        backgroundImage: "var(--bg-image-surface)",
        boxShadow: "var(--shadow-surface)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-pill)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `color-mix(in srgb, ${tone} 14%, transparent)`,
          color: tone,
        }}
      >
        {icon}
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</p>

      {description && (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, maxWidth: 420, lineHeight: 1.5 }}>
          {description}
        </p>
      )}

      {action && <StateActionButton action={action} tone={tone} />}
    </div>
  );
}

function StateActionButton({ action, tone }: { action: StateAction; tone: string }) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    // Cel dotyku ≥ 44 px w NOWYCH komponentach (rozdz. 10.7 architektury docelowej).
    minHeight: 44,
    padding: "0 18px",
    borderRadius: "var(--radius-control)",
    background: tone,
    border: "none",
    color: "var(--on-accent)",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  };

  if (action.href) {
    return (
      <a href={action.href} style={style}>
        {action.label}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} style={style}>
      {action.label}
    </button>
  );
}

// ─── Stan pusty ──────────────────────────────────────────────────────────────

export function ViewEmpty({
  icon,
  title = "Nic tu jeszcze nie ma",
  description,
  action,
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: StateAction;
}) {
  return (
    <StateFrame
      icon={icon ?? <Inbox size={20} />}
      tone="var(--text-muted)"
      title={title}
      description={description}
      action={action}
      dashed
      role="status"
    />
  );
}

// ─── Stan ładowania ──────────────────────────────────────────────────────────

/**
 * Szkielety zamiast kręciołka — pokazują KSZTAŁT tego, co się wczytuje, więc skok
 * układu po wczytaniu jest mniejszy.
 *
 * Animacja jest w `globals.css` (klasa `omnia-skeleton`), a NIE w znaczniku `<style>`
 * wewnątrz komponentu. To celowe: React escapuje cudzysłowy w tekstowym dziecku
 * `<style>` tylko na serwerze, a rozjazd hydratacji kładzie CAŁĄ aplikację
 * (doświadczenia.md, 2026-08-02).
 */
export function ViewLoading({ rows = 4, label = "Ładowanie…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="omnia-skeleton" style={{ height: 56, borderRadius: "var(--radius-lg)" }} />
      ))}
      <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>{label}</span>
    </div>
  );
}

// ─── Stan błędu ──────────────────────────────────────────────────────────────

export function ViewError({
  title = "Nie udało się wczytać",
  description = "Spróbuj ponownie. Jeśli problem się powtarza, odśwież stronę.",
  onRetry,
  retryLabel = "Spróbuj ponownie",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <StateFrame
      icon={<AlertTriangle size={20} />}
      tone="var(--accent-red)"
      title={title}
      description={description}
      action={onRetry ? { label: retryLabel, onClick: onRetry } : undefined}
      role="alert"
    />
  );
}

// ─── Brak dostępu ────────────────────────────────────────────────────────────

export function ViewNoAccess({
  title = "Brak dostępu",
  description = "Nie masz uprawnień do tego widoku. Poproś właściciela o dostęp.",
  action,
}: {
  title?: string;
  description?: string;
  action?: StateAction;
}) {
  return (
    <StateFrame
      icon={<Lock size={20} />}
      tone="var(--accent-amber)"
      title={title}
      description={description}
      action={action}
      role="status"
    />
  );
}

/** Ikona ponowienia — reeksport dla modułów budujących własną akcję błędu. */
export { RotateCw as RetryIcon };
