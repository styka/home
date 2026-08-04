"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useViewChrome } from "./ViewChrome";

/**
 * 045 — pasek bieżącego widoku. Trzy strefy:
 *
 *   [ filtry modułu ] … [ akcje modułu ] [ chrom powłoki ]
 *
 * Moduł podaje wyłącznie `filters` i `actions`. Chrom (gwiazdka ulubionych, świeżość
 * danych, ściągawka skrótów) przychodzi z kontekstu wypełnianego przez `AppShell` —
 * moduł o nim nie wie i nie musi go przekazywać. To jest cała istota kontraktu widoku.
 *
 * MOBILE (C-31): filtry przewijają się poziomo WE WŁASNYM kontenerze. Przewijanie
 * całej strony w poziomie jest zawsze błędem — a to najczęstszy sposób, w jaki
 * pasek narzędzi je powoduje.
 *
 * Adresu NIE czytamy tu przez `useSearchParams`: w komponencie tak blisko powłoki
 * wymusza on granicę `Suspense` i potrafi zepchnąć aplikację w renderowanie po
 * stronie klienta (lekcja z 042, opisana w `FavoriteStarButton`).
 */

export interface ViewBarProps {
  filters?: ReactNode;
  actions?: ReactNode;
  /** Ukrycie chromu — dla widoków osadzonych, np. w playgroundzie. */
  hideChrome?: boolean;
  /** Wariant gęsty: tytuł widoku wchodzi do paska zamiast osobnego nagłówka. */
  compact?: boolean;
  title?: string;
  titleHref?: string;
  icon?: ReactNode;
  iconColor?: string;
}

export function ViewBar({ filters, actions, hideChrome, compact, title, titleHref, icon, iconColor }: ViewBarProps) {
  const chrome = useViewChrome();
  const chromeItems = hideChrome
    ? []
    : [chrome.favorite, chrome.freshness, chrome.shortcuts].filter(Boolean);

  // Pusty pasek nie zajmuje miejsca — moduł bez filtrów i akcji, renderowany poza
  // powłoką, nie powinien dostawać pustej listwy z obramowaniem.
  if (!compact && !filters && !actions && chromeItems.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: compact ? 48 : 44,
        paddingTop: compact ? 0 : 8,
        paddingBottom: compact ? 0 : 8,
        borderBottom: "var(--border-width) var(--border-style) var(--border)",
      }}
    >
      {/* Wariant gęsty: tytuł w pasku, nie nad nim. */}
      {compact && title && (
        <h1
          className="hidden md:flex items-center gap-2 text-sm font-semibold truncate min-w-0"
          style={{ color: "var(--text-primary)", margin: 0, flexShrink: 0, maxWidth: "40%" }}
        >
          {icon && <span style={{ color: iconColor, display: "flex", flexShrink: 0 }}>{icon}</span>}
          {titleHref ? (
            <Link href={titleHref} className="truncate" style={{ color: "inherit", textDecoration: "none" }}>
              {title}
            </Link>
          ) : (
            <span className="truncate">{title}</span>
          )}
        </h1>
      )}
      {/* Filtry — jedyna strefa, która się kurczy i przewija. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflowX: "auto",
          // Pasek przewijania pod filtrami wyglądałby jak usterka — chowamy go,
          // ale samo przewijanie zostaje (dotyk, trackpad, Shift+kółko).
          scrollbarWidth: "none",
        }}
      >
        {filters}
      </div>

      {/* Akcje modułu — nie kurczą się. */}
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{actions}</div>
      )}

      {/* Chrom powłoki — zawsze na końcu, zawsze w tej samej kolejności,
          żeby ręka trafiała w gwiazdkę bez patrzenia. */}
      {chromeItems.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexShrink: 0,
            paddingLeft: 6,
            marginLeft: 2,
            borderLeft: "var(--border-width) var(--border-style) var(--border)",
          }}
        >
          {chromeItems.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
